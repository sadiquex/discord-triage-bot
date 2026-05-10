import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  // Partials are required so reactions on messages older than a few minutes
  // are not silently dropped by discord.js's internal cache.
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});
