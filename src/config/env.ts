import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),

  CHANNEL_ISSUE_TRACKER: z.string().min(1),
  CHANNEL_TRIAGED_ISSUES: z.string().min(1),
  CHANNEL_IN_PROGRESS: z.string().min(1),
  CHANNEL_QA_TESTING: z.string().min(1),
  CHANNEL_RESOLVED: z.string().min(1),
  CHANNEL_RELEASE_NOTES: z.string().min(1),

  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().default("claude-opus-4-7"),

  DATABASE_URL: z.string().min(1),

  ISSUE_PREFIX: z.string().default("COM"),
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
