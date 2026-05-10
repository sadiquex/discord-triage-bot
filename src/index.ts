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
