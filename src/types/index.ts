import type { Issue, IssueHistory, Attachment, Release } from "@prisma/client";

export type { Issue, IssueHistory, Attachment, Release };
export { Status, Severity } from "@prisma/client";

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface ParsedIssue {
  isIssue: boolean;
  confidence: number; // 0–1
  title: string;
  summary: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  stepsToReproduce: string[];
}

// ─── Repository input types ───────────────────────────────────────────────────

export interface CreateIssueInput {
  issueId: string;
  title: string;
  summary: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  stepsToReproduce: string[];
  reporterDiscordId: string;
  reporterName: string;
  originalMsgId: string;
  originalChannelId: string;
  guildId: string;
  attachments: AttachmentInput[];
}

export interface AttachmentInput {
  url: string;
  filename: string;
  contentType?: string;
}

export interface StatusActor {
  id: string;
  name: string;
}

// ─── Release ─────────────────────────────────────────────────────────────────

export interface ReleaseIssueItem {
  issueId: string;
  title: string;
  category: string;
}

// ─── GuildConfig ─────────────────────────────────────────────────────────────

export type { GuildConfig } from "@prisma/client";

export interface GuildConfigInput {
  guildId: string;
  issuePrefix: string;
  channelIssueTracker: string;
  channelTriaged: string;
  channelInProgress: string;
  channelQa: string;
  channelResolved: string;
  channelReleaseNotes: string;
}
