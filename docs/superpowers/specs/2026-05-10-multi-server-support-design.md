# Multi-Server Support Design

**Date:** 2026-05-10
**Branch:** feat/multi-server-support
**Status:** Approved

---

## Overview

The bot currently hardcodes all Discord channel IDs and the issue prefix in environment variables, limiting it to a single server per deployment. This design extends it to support any number of servers by storing per-guild configuration in the database and letting server admins configure the bot via a `/setup` slash command.

---

## 1. Database Schema

### New model: `GuildConfig`

```prisma
model GuildConfig {
  guildId             String   @id
  issuePrefix         String
  channelIssueTracker String
  channelTriaged      String
  channelInProgress   String
  channelQa           String
  channelResolved     String
  channelReleaseNotes String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

One row per Discord server. Created (or updated) when an admin runs `/setup`.

### Change to `Issue` ID generation

Currently counts all issues globally to derive the next number. Changes to count per guild+prefix:

```sql
SELECT COUNT(*) FROM "Issue"
WHERE "guildId" = $1 AND "issueId" LIKE $2
```

This gives each server an independent sequence — COM-001 in server A and APP-001 in server B never collide.

---

## 2. Commands

### `/setup prefix:<string>` (new)

- **Permission:** `Administrator` only (`defaultMemberPermissions: PermissionFlagsBits.Administrator`)
- **Behavior:**
  1. Creates a Discord category named `"Issue Tracker"`
  2. Creates 6 channels under it: `#issue-tracker`, `#triaged-issues`, `#in-progress`, `#qa-testing`, `#resolved`, `#release-notes`
  3. Upserts `GuildConfig` with the channel IDs and prefix
  4. Invalidates the in-memory cache for this guild
  5. Replies ephemerally: `✅ Issue tracker set up! Channels created under "Issue Tracker" with prefix <PREFIX>-`
- **Re-run behaviour:** Safe to run again — updates prefix, skips channel creation if channels already exist

### `/release version:<string>` (existing — internal change only)

No UX change. Internally reads `channelReleaseNotes` from `GuildConfig` instead of `env.CHANNEL_RELEASE_NOTES`.

### Slash command registration

Switches from per-guild (`Routes.applicationGuildCommands`) to **global** (`Routes.applicationCommands`). Global commands propagate to all servers automatically. Registered once at startup.

---

## 3. Guild Lifecycle Events

### `guildCreate`

When the bot joins a new server, post to the server's system channel (fall back to DMing the owner):

> 👋 **Issue Tracker Bot is here!**
> Run `/setup prefix:YOUR_PREFIX` to create the issue tracking channels and get started.

### `guildDelete`

No action — `GuildConfig` row is retained in case the bot is re-added later.

---

## 4. Event Handlers & Services

### Guild config cache

A `GuildConfigCache` class wraps an in-memory `Map<guildId, { config, expiresAt }>` with a 5-minute TTL. All lookups go through it; DB is only hit on a cache miss. `/setup` immediately evicts the entry for the configured guild.

### `GuildConfigRepository` (new)

```ts
class GuildConfigRepository {
  findByGuildId(guildId: string): Promise<GuildConfig | null>
  upsert(data: GuildConfigInput): Promise<GuildConfig>
}
```

### `reactionAdd.event.ts`

- Fetches guild config via cache before any processing
- If no config exists → silently ignore (bot not set up in this server)
- Replaces `env.CHANNEL_ISSUE_TRACKER` check with `config.channelIssueTracker`

### `issue.service.ts`

- `createIssue` receives `GuildConfig` as a parameter instead of reading from `env`
- `updateStatus` receives `GuildConfig` as a parameter for workflow channel lookups

### `release.service.ts`

- `generateAndPost` receives `GuildConfig` (specifically `channelReleaseNotes`) instead of `env.CHANNEL_RELEASE_NOTES`

### `interaction.event.ts`

- Fetches guild config before handling button interactions (needed to pass to `updateStatus`)

---

## 5. Env Var Cleanup

### Removed

```
DISCORD_GUILD_ID
CHANNEL_ISSUE_TRACKER
CHANNEL_TRIAGED_ISSUES
CHANNEL_IN_PROGRESS
CHANNEL_QA_TESTING
CHANNEL_RESOLVED
CHANNEL_RELEASE_NOTES
ISSUE_PREFIX
```

### Retained

```
DISCORD_TOKEN
DISCORD_CLIENT_ID
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
DATABASE_URL
NODE_ENV
LOG_LEVEL
```

---

## 6. Required Bot Permissions (invite URL)

Add `Manage Channels` to the existing permission set so the bot can create the category and channels on `/setup`.

---

## 7. Migration

No data migration needed for existing issues — the `guildId` column already exists on the `Issue` model. The only schema change is adding the new `GuildConfig` table.

Existing single-server deployment: after deploying, an admin runs `/setup prefix:COM` once. The bot creates fresh channels (or the admin can point the old channels manually if they prefer — but since `/setup` auto-creates, the simplest path is a clean setup).
