# Multi-Server Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the bot to support multiple Discord servers, each with its own channel configuration and issue prefix stored in the database.

**Architecture:** Add a `GuildConfig` table storing per-guild channel IDs and issue prefix. A `/setup` slash command (admin-only) auto-creates the required channels. All event handlers fetch guild config from an in-memory cache (backed by the DB) and pass it down to services. Slash commands switch from guild-scoped to global registration.

**Tech Stack:** TypeScript, Discord.js v14, Prisma 6, PostgreSQL (Neon), Jest + ts-jest

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `src/repositories/guildConfig.repository.ts` |
| Create | `src/services/guildConfig.cache.ts` |
| Create | `src/commands/setup.command.ts` |
| Create | `src/events/guildCreate.event.ts` |
| Create | `src/tests/guildConfig.cache.test.ts` |
| Create | `jest.config.js` |
| Modify | `src/types/index.ts` |
| Modify | `src/config/env.ts` |
| Modify | `src/utils/idGenerator.ts` |
| Modify | `src/services/issue.service.ts` |
| Modify | `src/services/release.service.ts` |
| Modify | `src/events/reactionAdd.event.ts` |
| Modify | `src/events/interaction.event.ts` |
| Modify | `src/index.ts` |
| Modify | `.env` |

---

## Task 1: Add GuildConfig to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add GuildConfig model**

In `prisma/schema.prisma`, add this model after the `Release` model:

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

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_guild_config
```

Expected output contains: `The migration "..._add_guild_config" was applied successfully`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add GuildConfig schema for multi-server support"
```

---

## Task 2: GuildConfigInput type + GuildConfigRepository

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/repositories/guildConfig.repository.ts`

- [ ] **Step 1: Add types to `src/types/index.ts`**

Append to the bottom of `src/types/index.ts`:

```typescript
export type { GuildConfig } from "@prisma/client";

export interface GuildConfigInput {
  guildId: string;
  issuePrefix: string;
  channelIssueTracker: string;
  channelTriaged: string;
  channelInProgress: string;
  channelQa: string;
  channelResolved: string;
  channelReleaseNotes: string;
}
```

- [ ] **Step 2: Create `src/repositories/guildConfig.repository.ts`**

```typescript
import { PrismaClient } from "@prisma/client";
import type { GuildConfig, GuildConfigInput } from "../types";

export class GuildConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByGuildId(guildId: string): Promise<GuildConfig | null> {
    return this.prisma.guildConfig.findUnique({ where: { guildId } });
  }

  async upsert(data: GuildConfigInput): Promise<GuildConfig> {
    return this.prisma.guildConfig.upsert({
      where: { guildId: data.guildId },
      create: data,
      update: {
        issuePrefix: data.issuePrefix,
        channelIssueTracker: data.channelIssueTracker,
        channelTriaged: data.channelTriaged,
        channelInProgress: data.channelInProgress,
        channelQa: data.channelQa,
        channelResolved: data.channelResolved,
        channelReleaseNotes: data.channelReleaseNotes,
      },
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/repositories/guildConfig.repository.ts
git commit -m "feat: add GuildConfigRepository"
```

---

## Task 3: GuildConfigCache + unit tests

**Files:**
- Create: `jest.config.js`
- Create: `src/services/guildConfig.cache.ts`
- Create: `src/tests/guildConfig.cache.test.ts`

- [ ] **Step 1: Install Jest**

```bash
npm install --save-dev jest ts-jest @types/jest
```

- [ ] **Step 2: Create `jest.config.js`**

```js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.ts"],
};
```

- [ ] **Step 3: Add test script to `package.json`**

In `package.json`, inside `"scripts"`, add:
```json
"test": "jest"
```

- [ ] **Step 4: Write failing tests — create `src/tests/guildConfig.cache.test.ts`**

```typescript
import { GuildConfigCache } from "../services/guildConfig.cache";
import type { GuildConfig } from "../types";

const makeConfig = (guildId: string): GuildConfig => ({
  guildId,
  issuePrefix: "COM",
  channelIssueTracker: "111",
  channelTriaged: "222",
  channelInProgress: "333",
  channelQa: "444",
  channelResolved: "555",
  channelReleaseNotes: "666",
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("GuildConfigCache", () => {
  let cache: GuildConfigCache;

  beforeEach(() => {
    cache = new GuildConfigCache();
  });

  it("returns null for unknown guild", () => {
    expect(cache.get("unknown")).toBeNull();
  });

  it("returns config after set", () => {
    const config = makeConfig("guild-1");
    cache.set("guild-1", config);
    expect(cache.get("guild-1")).toEqual(config);
  });

  it("returns null after invalidate", () => {
    const config = makeConfig("guild-2");
    cache.set("guild-2", config);
    cache.invalidate("guild-2");
    expect(cache.get("guild-2")).toBeNull();
  });

  it("expires entries after TTL", () => {
    cache = new GuildConfigCache(50); // 50ms TTL
    const config = makeConfig("guild-3");
    cache.set("guild-3", config);
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(cache.get("guild-3")).toBeNull();
        resolve();
      }, 100)
    );
  });
});
```

- [ ] **Step 5: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL with `Cannot find module '../services/guildConfig.cache'`

- [ ] **Step 6: Create `src/services/guildConfig.cache.ts`**

```typescript
import type { GuildConfig } from "../types";

interface CacheEntry {
  config: GuildConfig;
  expiresAt: number;
}

export class GuildConfigCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  get(guildId: string): GuildConfig | null {
    const entry = this.cache.get(guildId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(guildId);
      return null;
    }
    return entry.config;
  }

  set(guildId: string, config: GuildConfig): void {
    this.cache.set(guildId, { config, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }
}
```

- [ ] **Step 7: Run tests — verify they pass**

```bash
npm test
```

Expected: PASS — 4 tests pass

- [ ] **Step 8: Commit**

```bash
git add jest.config.js src/services/guildConfig.cache.ts src/tests/guildConfig.cache.test.ts package.json package-lock.json
git commit -m "feat: add GuildConfigCache with TTL"
```

---

## Task 4: Update idGenerator for per-guild sequences

**Files:**
- Modify: `src/utils/idGenerator.ts`

- [ ] **Step 1: Replace `src/utils/idGenerator.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

export async function generateIssueId(
  prisma: PrismaClient,
  guildId: string,
  prefix: string
): Promise<string> {
  const count = await prisma.issue.count({
    where: {
      guildId,
      issueId: { startsWith: `${prefix}-` },
    },
  });
  const number = String(count + 1).padStart(3, "0");
  return `${prefix}-${number}`;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: Errors only at `generateIssueId` call sites (still using old signature). Those are fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/utils/idGenerator.ts
git commit -m "feat: generate issue IDs per guild+prefix sequence"
```

---

## Task 5: /setup command definition

**Files:**
- Create: `src/commands/setup.command.ts`

- [ ] **Step 1: Create `src/commands/setup.command.ts`**

```typescript
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Create issue tracker channels in this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("prefix")
      .setDescription("Issue ID prefix (e.g. COM → COM-001)")
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(8)
  );
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/setup.command.ts
git commit -m "feat: add /setup slash command definition"
```

---

## Task 6: guildCreate welcome event

**Files:**
- Create: `src/events/guildCreate.event.ts`

- [ ] **Step 1: Create `src/events/guildCreate.event.ts`**

```typescript
import { Guild } from "discord.js";
import { logger } from "../utils/logger";

const WELCOME_MESSAGE =
  "👋 **Issue Tracker Bot is here!**\nRun `/setup prefix:YOUR_PREFIX` to create the issue tracking channels and get started.";

export function registerGuildCreateEvent() {
  return async (guild: Guild): Promise<void> => {
    try {
      if (guild.systemChannel) {
        await guild.systemChannel.send(WELCOME_MESSAGE);
      } else {
        const owner = await guild.fetchOwner();
        await owner.send(WELCOME_MESSAGE);
      }
    } catch (err) {
      logger.warn({ err, guildId: guild.id }, "Failed to send welcome message on guild join");
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/events/guildCreate.event.ts
git commit -m "feat: send welcome message when bot joins a new server"
```

---

## Task 7: Strip single-server env vars

**Files:**
- Modify: `src/config/env.ts`

- [ ] **Step 1: Replace `src/config/env.ts`**

```typescript
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-7"),

  DATABASE_URL: z.string().min(1),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
```

- [ ] **Step 2: Check how many stale usages remain**

```bash
npx tsc --noEmit 2>&1 | grep "env\."
```

Expected: Errors in `issue.service.ts`, `release.service.ts`, `reactionAdd.event.ts`, and `index.ts`. All fixed in Tasks 8–12.

- [ ] **Step 3: Commit**

```bash
git add src/config/env.ts
git commit -m "chore: remove single-server channel env vars"
```

---

## Task 8: Update IssueService

**Files:**
- Modify: `src/services/issue.service.ts`

- [ ] **Step 1: Replace `src/services/issue.service.ts`**

```typescript
import { Client, Message, TextChannel } from "discord.js";
import { Status } from "@prisma/client";
import { logger } from "../utils/logger";
import { buildIssueEmbed, buildActionRow } from "./formatter.service";
import type { ThreadService } from "./thread.service";
import type { IssueRepository } from "../repositories/issue.repository";
import type { Issue, ParsedIssue, CreateIssueInput, StatusActor, GuildConfig } from "../types";
import type { ButtonInteraction } from "discord.js";

export class IssueService {
  constructor(
    private readonly client: Client,
    private readonly issueRepo: IssueRepository,
    private readonly threadService: ThreadService
  ) {}

  async createIssue(
    parsed: ParsedIssue,
    originalMessage: Message,
    issueId: string,
    config: GuildConfig
  ): Promise<Issue> {
    const attachments = [...originalMessage.attachments.values()].map((a) => ({
      url: a.url,
      filename: a.name,
      contentType: a.contentType ?? undefined,
    }));

    const input: CreateIssueInput = {
      issueId,
      title: parsed.title,
      summary: parsed.summary,
      severity: parsed.severity,
      category: parsed.category,
      stepsToReproduce: parsed.stepsToReproduce,
      reporterDiscordId: originalMessage.author.id,
      reporterName: originalMessage.author.username,
      originalMsgId: originalMessage.id,
      originalChannelId: originalMessage.channelId,
      guildId: originalMessage.guildId!,
      attachments,
    };

    let issue = await this.issueRepo.create(input);

    const triagedChannel = (await this.client.channels.fetch(
      config.channelTriaged
    )) as TextChannel;

    const embed = buildIssueEmbed(issue as Issue & { attachments: { url: string; filename: string }[] });
    const row = buildActionRow(issue);

    const triagedMsg = await triagedChannel.send({ embeds: [embed], components: [row] });

    const threadId = await this.threadService.createThread(triagedMsg, issueId);

    issue = await this.issueRepo.updateTriagedMessage(
      issueId,
      triagedMsg.id,
      triagedChannel.id,
      threadId
    );

    await originalMessage.reply(
      `✅ Triaged as **${issueId}** → ${triagedMsg.url}\n💬 Discussion: <#${threadId}>`
    );

    logger.info({ issueId, triagedMsgId: triagedMsg.id }, "Issue created and triaged");
    return issue;
  }

  async updateStatus(
    interaction: ButtonInteraction,
    issueId: string,
    newStatus: Status,
    actor: StatusActor,
    config: GuildConfig
  ): Promise<void> {
    const updatedIssue = await this.issueRepo.updateStatus(issueId, newStatus, actor);

    if (updatedIssue.triagedMsgId && updatedIssue.triagedChannelId) {
      const channel = (await this.client.channels.fetch(
        updatedIssue.triagedChannelId
      )) as TextChannel;
      const triagedMsg = await channel.messages.fetch(updatedIssue.triagedMsgId);
      const embed = buildIssueEmbed(
        updatedIssue as Issue & { attachments: { url: string; filename: string }[] }
      );
      const row = buildActionRow(updatedIssue);
      await triagedMsg.edit({ embeds: [embed], components: [row] });
    }

    const workflowChannelId = getWorkflowChannelId(newStatus, config);
    if (workflowChannelId) {
      const workflowChannel = (await this.client.channels.fetch(workflowChannelId)) as TextChannel;

      const statusEmoji: Record<string, string> = {
        [Status.IN_PROGRESS]: "🛠️",
        [Status.QA]: "🧪",
        [Status.RESOLVED]: "✅",
      };

      const emoji = statusEmoji[newStatus] ?? "🔄";
      const jumpUrl =
        updatedIssue.triagedMsgId && updatedIssue.triagedChannelId
          ? `https://discord.com/channels/${updatedIssue.guildId}/${updatedIssue.triagedChannelId}/${updatedIssue.triagedMsgId}`
          : "";

      await workflowChannel.send(
        `${emoji} **${issueId}** — ${updatedIssue.title}\nUpdated by <@${actor.id}>${jumpUrl ? ` → [Jump to issue](${jumpUrl})` : ""}`
      );
    }

    logger.info({ issueId, newStatus, actor: actor.name }, "Issue status updated");
  }
}

function getWorkflowChannelId(status: Status, config: GuildConfig): string | undefined {
  const map: Partial<Record<Status, string>> = {
    [Status.IN_PROGRESS]: config.channelInProgress,
    [Status.QA]: config.channelQa,
    [Status.RESOLVED]: config.channelResolved,
  };
  return map[status];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/issue.service.ts
git commit -m "feat: pass GuildConfig into IssueService"
```

---

## Task 9: Update ReleaseService

**Files:**
- Modify: `src/services/release.service.ts`

- [ ] **Step 1: Replace `src/services/release.service.ts`**

```typescript
import { Client, TextChannel, EmbedBuilder, Colors } from "discord.js";
import { logger } from "../utils/logger";
import type { AiService } from "./ai.service";
import type { IssueRepository } from "../repositories/issue.repository";
import type { ReleaseRepository } from "../repositories/release.repository";
import type { Release, GuildConfig } from "../types";

export class ReleaseService {
  constructor(
    private readonly client: Client,
    private readonly ai: AiService,
    private readonly issueRepo: IssueRepository,
    private readonly releaseRepo: ReleaseRepository
  ) {}

  async generateAndPost(
    version: string,
    postedById: string,
    postedByName: string,
    config: GuildConfig
  ): Promise<{ release: Release; channelUrl: string }> {
    const unreleased = await this.issueRepo.findUnreleased();

    if (unreleased.length === 0) {
      throw new Error("No resolved issues available to release.");
    }

    const issueItems = unreleased.map((i) => ({
      issueId: i.issueId,
      title: i.title,
      category: i.category,
    }));

    const notes = await this.ai.generateReleaseNotes(version, issueItems);

    const existing = await this.releaseRepo.findByVersion(version);
    if (existing) {
      throw new Error(`Release ${version} already exists.`);
    }

    const release = await this.releaseRepo.create({
      version,
      notes,
      postedBy: postedByName,
    });

    await this.issueRepo.attachToRelease(
      unreleased.map((i) => i.issueId),
      release.id
    );

    const channel = (await this.client.channels.fetch(
      config.channelReleaseNotes
    )) as TextChannel;

    const embed = new EmbedBuilder()
      .setTitle(`🚀 Release ${version}`)
      .setDescription(notes)
      .setColor(Colors.Blurple)
      .addFields({ name: "Issues resolved", value: String(unreleased.length), inline: true })
      .setTimestamp()
      .setFooter({ text: `Released by ${postedByName}` });

    const msg = await channel.send({ embeds: [embed] });

    logger.info({ version, issueCount: unreleased.length }, "Release posted");

    return { release, channelUrl: msg.url };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/release.service.ts
git commit -m "feat: pass GuildConfig into ReleaseService"
```

---

## Task 10: Update reactionAdd event

**Files:**
- Modify: `src/events/reactionAdd.event.ts`

- [ ] **Step 1: Replace `src/events/reactionAdd.event.ts`**

```typescript
import {
  MessageReaction,
  User,
  PartialMessageReaction,
  PartialUser,
  TextChannel,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";
import type { AiService } from "../services/ai.service";
import type { IssueService } from "../services/issue.service";
import type { IssueRepository } from "../repositories/issue.repository";
import type { GuildConfigRepository } from "../repositories/guildConfig.repository";
import type { GuildConfigCache } from "../services/guildConfig.cache";
import { generateIssueId } from "../utils/idGenerator";

const TRIAGE_EMOJI = "🐞";

export function registerReactionAddEvent(
  aiService: AiService,
  issueService: IssueService,
  issueRepo: IssueRepository,
  prisma: PrismaClient,
  guildConfigRepo: GuildConfigRepository,
  cache: GuildConfigCache
) {
  return async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> => {
    if (user.bot) return;
    if (reaction.emoji.name !== TRIAGE_EMOJI) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        logger.error({ err }, "Failed to fetch partial reaction");
        return;
      }
    }

    const message = reaction.message.partial
      ? await reaction.message.fetch()
      : reaction.message;

    if (!message.guildId) return;
    if (message.author?.bot) return;

    const config =
      cache.get(message.guildId) ?? await guildConfigRepo.findByGuildId(message.guildId);

    if (!config) {
      logger.debug({ guildId: message.guildId }, "No guild config, skipping reaction");
      return;
    }

    cache.set(message.guildId, config);

    if (message.channelId !== config.channelIssueTracker) return;

    const existing = await issueRepo.findByOriginalMsgId(message.id);
    if (existing) {
      logger.debug({ issueId: existing.issueId }, "Message already triaged, skipping");
      return;
    }

    logger.info({ messageId: message.id, user: user.username }, "🐞 reaction detected, triaging");

    try {
      const content = message.content ?? "";
      const attachmentCount = message.attachments.size;

      const parsed = await aiService.parseIssue(
        content,
        attachmentCount,
        message.author?.username ?? "Unknown"
      );

      if (!aiService.isAboveConfidenceThreshold(parsed)) {
        logger.info(
          { confidence: parsed.confidence, isIssue: parsed.isIssue },
          "AI confidence below threshold, skipping triage"
        );
        return;
      }

      const issueId = await generateIssueId(prisma, message.guildId, config.issuePrefix);
      await issueService.createIssue(parsed, message as any, issueId, config);
    } catch (err) {
      logger.error({ err, messageId: message.id }, "Failed to triage issue");
      try {
        const channel = message.channel as TextChannel;
        await channel.send(
          `⚠️ Failed to triage that message. Please try again or contact an admin.`
        );
      } catch {
        // best-effort
      }
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/events/reactionAdd.event.ts
git commit -m "feat: fetch guild config per-server in reaction handler"
```

---

## Task 11: Update interaction event — handle /setup, pass config

**Files:**
- Modify: `src/events/interaction.event.ts`

- [ ] **Step 1: Replace `src/events/interaction.event.ts`**

```typescript
import { Interaction, MessageFlags, ChannelType } from "discord.js";
import { logger } from "../utils/logger";
import { parseButtonId, actionToStatus } from "../services/formatter.service";
import type { IssueService } from "../services/issue.service";
import type { IssueRepository } from "../repositories/issue.repository";
import type { ReleaseService } from "../services/release.service";
import type { GuildConfigRepository } from "../repositories/guildConfig.repository";
import type { GuildConfigCache } from "../services/guildConfig.cache";
import type { GuildConfig, GuildConfigInput } from "../types";

export function registerInteractionEvent(
  issueService: IssueService,
  issueRepo: IssueRepository,
  releaseService: ReleaseService,
  guildConfigRepo: GuildConfigRepository,
  cache: GuildConfigCache
) {
  return async (interaction: Interaction): Promise<void> => {
    if (interaction.isButton()) {
      const parsed = parseButtonId(interaction.customId);
      if (!parsed) return;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const { action, issueId } = parsed;
      const newStatus = actionToStatus(action);

      if (!newStatus) {
        await interaction.editReply(`❓ Unknown action: \`${action}\``);
        return;
      }

      const config = interaction.guildId
        ? (cache.get(interaction.guildId) ?? await guildConfigRepo.findByGuildId(interaction.guildId))
        : null;

      if (!config) {
        await interaction.editReply("❌ Bot not configured. Ask an admin to run `/setup`.");
        return;
      }

      cache.set(interaction.guildId!, config);

      const issue = await issueRepo.findByIssueId(issueId);
      if (!issue) {
        await interaction.editReply(`❌ Issue **${issueId}** not found.`);
        return;
      }

      try {
        await issueService.updateStatus(
          interaction,
          issueId,
          newStatus,
          { id: interaction.user.id, name: interaction.user.username },
          config
        );
        await interaction.editReply(
          `✅ **${issueId}** status updated to **${newStatus.replace("_", " ")}**.`
        );
      } catch (err) {
        logger.error({ err, issueId, action }, "Failed to update issue status");
        await interaction.editReply(`⚠️ Failed to update status. Please try again.`);
      }

      return;
    }

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup") {
        await handleSetupCommand(interaction, guildConfigRepo, cache);
        return;
      }

      if (interaction.commandName === "release") {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const config = interaction.guildId
          ? (cache.get(interaction.guildId) ?? await guildConfigRepo.findByGuildId(interaction.guildId))
          : null;

        if (!config) {
          await interaction.editReply("❌ Bot not configured. Ask an admin to run `/setup`.");
          return;
        }

        cache.set(interaction.guildId!, config);

        const version = interaction.options.getString("version", true);

        try {
          const { release, channelUrl } = await releaseService.generateAndPost(
            version,
            interaction.user.id,
            interaction.user.username,
            config
          );
          await interaction.editReply(`🚀 Release **${release.version}** posted → ${channelUrl}`);
        } catch (err: any) {
          logger.error({ err, version }, "Failed to generate release notes");
          await interaction.editReply(
            `⚠️ ${err instanceof Error ? err.message : "Failed to generate release notes."}`
          );
        }
      }
    }
  };
}

async function handleSetupCommand(
  interaction: import("discord.js").ChatInputCommandInteraction,
  guildConfigRepo: GuildConfigRepository,
  cache: GuildConfigCache
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const prefix = interaction.options.getString("prefix", true).toUpperCase();
  const guild = interaction.guild!;

  const existing = await guildConfigRepo.findByGuildId(guild.id);

  if (existing) {
    const updated = await guildConfigRepo.upsert({
      guildId: existing.guildId,
      issuePrefix: prefix,
      channelIssueTracker: existing.channelIssueTracker,
      channelTriaged: existing.channelTriaged,
      channelInProgress: existing.channelInProgress,
      channelQa: existing.channelQa,
      channelResolved: existing.channelResolved,
      channelReleaseNotes: existing.channelReleaseNotes,
    });
    cache.set(guild.id, updated);
    await interaction.editReply(`✅ Prefix updated to \`${prefix}-\`. Existing channels unchanged.`);
    return;
  }

  const CHANNEL_DEFS: { key: keyof Omit<GuildConfigInput, "guildId" | "issuePrefix">; name: string }[] = [
    { key: "channelIssueTracker", name: "issue-tracker" },
    { key: "channelTriaged", name: "triaged-issues" },
    { key: "channelInProgress", name: "in-progress" },
    { key: "channelQa", name: "qa-testing" },
    { key: "channelResolved", name: "resolved" },
    { key: "channelReleaseNotes", name: "release-notes" },
  ];

  const category = await guild.channels.create({
    name: "Issue Tracker",
    type: ChannelType.GuildCategory,
  });

  const channelIds = {} as Record<string, string>;
  for (const { key, name } of CHANNEL_DEFS) {
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
    });
    channelIds[key] = channel.id;
  }

  const config = await guildConfigRepo.upsert({
    guildId: guild.id,
    issuePrefix: prefix,
    channelIssueTracker: channelIds.channelIssueTracker,
    channelTriaged: channelIds.channelTriaged,
    channelInProgress: channelIds.channelInProgress,
    channelQa: channelIds.channelQa,
    channelResolved: channelIds.channelResolved,
    channelReleaseNotes: channelIds.channelReleaseNotes,
  });

  cache.set(guild.id, config);

  await interaction.editReply(
    `✅ Issue tracker set up! Channels created under **"Issue Tracker"** with prefix \`${prefix}-\``
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/events/interaction.event.ts
git commit -m "feat: handle /setup and thread guild config through interaction handler"
```

---

## Task 12: Wire index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Replace `src/index.ts`**

```typescript
import http from "http";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { client } from "./bot/client";
import { PrismaClient } from "@prisma/client";
import { REST, Routes } from "discord.js";
import { AiService } from "./services/ai.service";
import { IssueService } from "./services/issue.service";
import { ThreadService } from "./services/thread.service";
import { ReleaseService } from "./services/release.service";
import { GuildConfigCache } from "./services/guildConfig.cache";
import { IssueRepository } from "./repositories/issue.repository";
import { ReleaseRepository } from "./repositories/release.repository";
import { GuildConfigRepository } from "./repositories/guildConfig.repository";
import { registerReactionAddEvent } from "./events/reactionAdd.event";
import { registerInteractionEvent } from "./events/interaction.event";
import { registerGuildCreateEvent } from "./events/guildCreate.event";
import { releaseCommand } from "./commands/release.command";
import { setupCommand } from "./commands/setup.command";

async function main() {
  const prisma = new PrismaClient();
  await prisma.$connect();
  logger.info("Connected to database");

  const cache = new GuildConfigCache();
  const aiService = new AiService();
  const threadService = new ThreadService();
  const issueRepo = new IssueRepository(prisma);
  const releaseRepo = new ReleaseRepository(prisma);
  const guildConfigRepo = new GuildConfigRepository(prisma);
  const issueService = new IssueService(client, issueRepo, threadService);
  const releaseService = new ReleaseService(client, aiService, issueRepo, releaseRepo);

  client.on("clientReady", async (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, "Bot is online");
    await registerSlashCommands();
  });

  client.on(
    "messageReactionAdd",
    registerReactionAddEvent(aiService, issueService, issueRepo, prisma, guildConfigRepo, cache)
  );

  client.on(
    "interactionCreate",
    registerInteractionEvent(issueService, issueRepo, releaseService, guildConfigRepo, cache)
  );

  client.on("guildCreate", registerGuildCreateEvent());

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  client.on("shardError", (err, shardId) => {
    logger.error({ err, shardId }, "Discord shard WebSocket error");
  });

  client.on("shardDisconnect", (event, shardId) => {
    logger.warn({ code: event.code, reason: event.reason, shardId }, "Discord shard disconnected");
  });

  logger.info({ tokenLength: env.DISCORD_TOKEN.length }, "Attempting Discord login");

  const loginTimeout = setTimeout(() => {
    logger.fatal("Discord login timed out after 30 seconds");
    process.exit(1);
  }, 30_000);

  await client.login(env.DISCORD_TOKEN);
  clearTimeout(loginTimeout);
  logger.info("Discord login successful");
}

async function registerSlashCommands() {
  const rest = new REST().setToken(env.DISCORD_TOKEN);
  try {
    await rest.put(
      Routes.applicationCommands(env.DISCORD_CLIENT_ID),
      { body: [releaseCommand.toJSON(), setupCommand.toJSON()] }
    );
    logger.info("Slash commands registered globally");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }
}

const PORT = process.env.PORT ?? 3000;
http.createServer((_, res) => { res.writeHead(200); res.end("ok"); }).listen(Number(PORT), "0.0.0.0");

main().catch((err) => {
  logger.fatal({ err }, "Fatal error during startup");
  process.exit(1);
});
```

- [ ] **Step 2: Verify full TypeScript compile**

```bash
npx tsc --noEmit
```

Expected: **No errors.**

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire multi-server support — global commands, guild config, guildCreate event"
```

---

## Task 13: Update .env + deploy

**Files:**
- Modify: `.env`

- [ ] **Step 1: Deploy new code first**

Deploy before unsetting secrets — the currently running code still requires those vars, so unsetting first would cause a failed redeploy.

```bash
fly deploy
```

Expected: Build succeeds, machine reaches `started` state.

- [ ] **Step 2: Verify healthy startup in logs**

```bash
fly logs
```

Expected lines (in order):
```
Connected to database
Attempting Discord login
Bot is online
Slash commands registered globally
```

- [ ] **Step 3: Remove stale secrets from Fly.io**

Now that the new code is running (which no longer reads these vars), it's safe to remove them.

```bash
fly secrets unset DISCORD_GUILD_ID CHANNEL_ISSUE_TRACKER CHANNEL_TRIAGED_ISSUES CHANNEL_IN_PROGRESS CHANNEL_QA_TESTING CHANNEL_RESOLVED CHANNEL_RELEASE_NOTES ISSUE_PREFIX
```

Expected: Fly redeploys automatically and bot starts cleanly.

- [ ] **Step 4: Remove stale vars from `.env`**

Delete these lines from `.env`:
```
DISCORD_GUILD_ID=...
CHANNEL_ISSUE_TRACKER=...
CHANNEL_TRIAGED_ISSUES=...
CHANNEL_IN_PROGRESS=...
CHANNEL_QA_TESTING=...
CHANNEL_RESOLVED=...
CHANNEL_RELEASE_NOTES=...
ISSUE_PREFIX=...
```

- [ ] **Step 5: Commit .env**

```bash
git add .env
git commit -m "chore: remove single-server env vars"
```

---

## Task 14: Manual E2E verification

- [ ] **Step 1: Run /setup in your existing server**

```
/setup prefix:COM
```

Expected: Bot replies `✅ Issue tracker set up! Channels created under "Issue Tracker" with prefix COM-`
A new **Issue Tracker** category appears in the server with 6 channels.

- [ ] **Step 2: Verify /setup re-run only changes prefix**

```
/setup prefix:BUG
```

Expected: `✅ Prefix updated to BUG-. Existing channels unchanged.` — no new channels created.

- [ ] **Step 3: Restore the real prefix**

```
/setup prefix:COM
```

- [ ] **Step 4: Test triage in the new #issue-tracker channel**

Post a bug description in the new `#issue-tracker`, react with 🐞.
Expected: Issue triaged as `COM-XXX`, embed in `#triaged-issues`, thread created.

- [ ] **Step 5: Test button interactions**

Click **Acknowledge → Start Work → Send to QA → Resolve** on the triaged embed.
Expected: Status updates, workflow notifications appear in the correct channels.

- [ ] **Step 6: Test /release**

```
/release version:2.0.0
```

Expected: Release embed posted to `#release-notes`, ephemeral reply with link.

- [ ] **Step 7: Test second server**

Add the bot to a second Discord server (update invite URL to include `Manage Channels` permission: add `16` to the permissions bitmask or regenerate via OAuth2 URL Generator).

Expected: Bot posts welcome message with `/setup` instructions.

- [ ] **Step 8: Run /setup in second server**

```
/setup prefix:APP
```

Expected: Fresh **Issue Tracker** category + 6 channels. Issues in this server will sequence as `APP-001`, `APP-002`, independent of the first server.
