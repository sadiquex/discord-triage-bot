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
