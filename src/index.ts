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
import { IssueRepository } from "./repositories/issue.repository";
import { ReleaseRepository } from "./repositories/release.repository";
import { registerReactionAddEvent } from "./events/reactionAdd.event";
import { registerInteractionEvent } from "./events/interaction.event";
import { releaseCommand } from "./commands/release.command";

async function main() {
  // ── Database ────────────────────────────────────────────────────────────────
  const prisma = new PrismaClient();
  await prisma.$connect();
  logger.info("Connected to database");

  // ── Services ────────────────────────────────────────────────────────────────
  const aiService = new AiService();
  const threadService = new ThreadService();
  const issueRepo = new IssueRepository(prisma);
  const releaseRepo = new ReleaseRepository(prisma);
  const issueService = new IssueService(client, issueRepo, threadService);
  const releaseService = new ReleaseService(client, aiService, issueRepo, releaseRepo);

  // ── Discord events ──────────────────────────────────────────────────────────
  client.on("ready", async (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, "Bot is online");
    await registerSlashCommands();
  });

  client.on(
    "messageReactionAdd",
    registerReactionAddEvent(aiService, issueService, issueRepo, prisma)
  );

  client.on(
    "interactionCreate",
    registerInteractionEvent(issueService, issueRepo, releaseService)
  );

  client.on("error", (err) => {
    logger.error({ err }, "Discord client error");
  });

  client.on("shardError", (err, shardId) => {
    logger.error({ err, shardId }, "Discord shard WebSocket error");
  });

  client.on("shardDisconnect", (event, shardId) => {
    logger.warn({ code: event.code, reason: event.reason, shardId }, "Discord shard disconnected");
  });

  // ── Login ───────────────────────────────────────────────────────────────────
  logger.info({ tokenLength: env.DISCORD_TOKEN.length, tokenPrefix: env.DISCORD_TOKEN.slice(0, 10) }, "Attempting Discord login");

  const loginTimeout = setTimeout(() => {
    logger.fatal("Discord login timed out after 30 seconds — check privileged intents in Discord Developer Portal");
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
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
      { body: [releaseCommand.toJSON()] }
    );
    logger.info("Slash commands registered");
  } catch (err) {
    logger.error({ err }, "Failed to register slash commands");
  }
}

// Keep Render's free web service alive (pinged by UptimeRobot every 5 min)
const PORT = process.env.PORT ?? 3000;
http.createServer((_, res) => { res.writeHead(200); res.end("ok"); }).listen(PORT);

main().catch((err) => {
  logger.fatal({ err }, "Fatal error during startup");
  process.exit(1);
});
