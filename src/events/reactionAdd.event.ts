import {
  MessageReaction,
  User,
  PartialMessageReaction,
  PartialUser,
  TextChannel,
} from "discord.js";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { AiService } from "../services/ai.service";
import type { IssueService } from "../services/issue.service";
import type { IssueRepository } from "../repositories/issue.repository";
import { generateIssueId } from "../utils/idGenerator";
import { PrismaClient } from "@prisma/client";

const TRIAGE_EMOJI = "🐞";

export function registerReactionAddEvent(
  aiService: AiService,
  issueService: IssueService,
  issueRepo: IssueRepository,
  prisma: PrismaClient
) {
  return async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser
  ): Promise<void> => {
    // Ignore bot reactions
    if (user.bot) return;

    // Only handle the triage emoji
    if (reaction.emoji.name !== TRIAGE_EMOJI) return;

    // Fetch partial reaction/message if needed (required when using Partials)
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

    // Only process messages in #issue-tracker
    if (message.channelId !== env.CHANNEL_ISSUE_TRACKER) return;

    // Ignore bot messages
    if (message.author?.bot) return;

    // Idempotency: skip if already triaged
    const existing = await issueRepo.findByOriginalMsgId(message.id);
    if (existing) {
      logger.debug({ issueId: existing.issueId }, "Message already triaged, skipping");
      return;
    }

    logger.info({ messageId: message.id, user: user.username }, "🐞 reaction detected, triaging");

    try {
      const content = message.content ?? "";
      const attachmentCount = message.attachments.size;

      const parsed = await aiService.parseIssue(content, attachmentCount, message.author?.username ?? "Unknown");

      if (!aiService.isAboveConfidenceThreshold(parsed)) {
        logger.info(
          { confidence: parsed.confidence, isIssue: parsed.isIssue },
          "AI confidence below threshold, skipping triage"
        );
        // Quietly remove the bot reaction if we added one, otherwise just skip
        return;
      }

      const issueId = await generateIssueId(prisma);
      await issueService.createIssue(parsed, message as any, issueId);
    } catch (err) {
      logger.error({ err, messageId: message.id }, "Failed to triage issue");

      // Notify in the original channel on failure
      try {
        const channel = message.channel as TextChannel;
        await channel.send(
          `⚠️ Failed to triage that message. Please try again or contact an admin.`
        );
      } catch {
        // best-effort notification
      }
    }
  };
}
