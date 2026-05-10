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
