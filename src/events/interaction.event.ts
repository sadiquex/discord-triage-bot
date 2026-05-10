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
