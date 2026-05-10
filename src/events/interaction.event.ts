import { Interaction } from "discord.js";
import { logger } from "../utils/logger";
import { parseButtonId, actionToStatus } from "../services/formatter.service";
import type { IssueService } from "../services/issue.service";
import type { IssueRepository } from "../repositories/issue.repository";
import type { ReleaseService } from "../services/release.service";

export function registerInteractionEvent(
  issueService: IssueService,
  issueRepo: IssueRepository,
  releaseService: ReleaseService
) {
  return async (interaction: Interaction): Promise<void> => {
    // ── Button interactions (issue lifecycle) ────────────────────────────────
    if (interaction.isButton()) {
      const parsed = parseButtonId(interaction.customId);
      if (!parsed) return;

      const { action, issueId } = parsed;
      const newStatus = actionToStatus(action);

      if (!newStatus) {
        await interaction.reply({
          content: `❓ Unknown action: \`${action}\``,
          ephemeral: true,
        });
        return;
      }

      const issue = await issueRepo.findByIssueId(issueId);
      if (!issue) {
        await interaction.reply({
          content: `❌ Issue **${issueId}** not found.`,
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      try {
        await issueService.updateStatus(interaction, issueId, newStatus, {
          id: interaction.user.id,
          name: interaction.user.username,
        });

        await interaction.editReply({
          content: `✅ **${issueId}** status updated to **${newStatus.replace("_", " ")}**.`,
        });
      } catch (err) {
        logger.error({ err, issueId, action }, "Failed to update issue status");
        await interaction.editReply({
          content: `⚠️ Failed to update status. Please try again.`,
        });
      }

      return;
    }

    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "release") {
        await handleReleaseCommand(interaction, releaseService);
      }
    }
  };
}

async function handleReleaseCommand(
  interaction: import("discord.js").ChatInputCommandInteraction,
  releaseService: ReleaseService
): Promise<void> {
  const version = interaction.options.getString("version", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    const { release, channelUrl } = await releaseService.generateAndPost(
      version,
      interaction.user.id,
      interaction.user.username
    );

    await interaction.editReply(
      `🚀 Release **${release.version}** posted → ${channelUrl}`
    );
  } catch (err: any) {
    logger.error({ err, version }, "Failed to generate release notes");
    await interaction.editReply(
      `⚠️ ${err instanceof Error ? err.message : "Failed to generate release notes."}`
    );
  }
}
