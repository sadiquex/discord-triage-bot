import { Message, ThreadAutoArchiveDuration } from "discord.js";
import { logger } from "../utils/logger";

export class ThreadService {
  async createThread(triagedMessage: Message, issueId: string): Promise<string> {
    const thread = await triagedMessage.startThread({
      name: `${issueId} Discussion`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `Discussion thread for ${issueId}`,
    });

    await thread.send(
      `👋 This is the discussion thread for **${issueId}**.\nUse this thread for reproduction details, investigation notes, and fix tracking.`
    );

    logger.info({ issueId, threadId: thread.id }, "Thread created");
    return thread.id;
  }
}
