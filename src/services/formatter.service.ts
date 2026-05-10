import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
} from "discord.js";
import { Status, Severity } from "@prisma/client";
import type { Issue } from "../types";

// ─── Status display ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<Status, string> = {
  [Status.BACKLOG]: "🟡 Backlog",
  [Status.ACKNOWLEDGED]: "🔵 Acknowledged",
  [Status.IN_PROGRESS]: "🟠 In Progress",
  [Status.QA]: "🟣 QA Testing",
  [Status.RESOLVED]: "🟢 Resolved",
  [Status.CLOSED]: "⚫ Closed",
  [Status.REJECTED]: "🔴 Rejected",
};

const STATUS_COLOR: Record<Status, number> = {
  [Status.BACKLOG]: Colors.Yellow,
  [Status.ACKNOWLEDGED]: Colors.Blue,
  [Status.IN_PROGRESS]: Colors.Orange,
  [Status.QA]: Colors.Purple,
  [Status.RESOLVED]: Colors.Green,
  [Status.CLOSED]: Colors.DarkGrey,
  [Status.REJECTED]: Colors.Red,
};

const SEVERITY_LABEL: Record<Severity, string> = {
  [Severity.LOW]: "🟢 Low",
  [Severity.MEDIUM]: "🟡 Medium",
  [Severity.HIGH]: "🟠 High",
  [Severity.CRITICAL]: "🔴 Critical",
};

// ─── Button IDs ───────────────────────────────────────────────────────────────

export const BUTTON_PREFIX = "issue_action";

export function buildButtonId(action: string, issueId: string): string {
  return `${BUTTON_PREFIX}:${action}:${issueId}`;
}

export function parseButtonId(customId: string): { action: string; issueId: string } | null {
  if (!customId.startsWith(BUTTON_PREFIX + ":")) return null;
  const parts = customId.split(":");
  if (parts.length !== 3) return null;
  return { action: parts[1], issueId: parts[2] };
}

// ─── Status → action mapping ──────────────────────────────────────────────────

const ACTION_TO_STATUS: Record<string, Status> = {
  acknowledge: Status.ACKNOWLEDGED,
  start: Status.IN_PROGRESS,
  qa: Status.QA,
  resolve: Status.RESOLVED,
  reject: Status.REJECTED,
};

export function actionToStatus(action: string): Status | null {
  return ACTION_TO_STATUS[action] ?? null;
}

// ─── Embed builder ────────────────────────────────────────────────────────────

export function buildIssueEmbed(issue: Issue & { attachments: { url: string; filename: string }[] }): EmbedBuilder {
  const steps = Array.isArray(issue.stepsToReproduce)
    ? (issue.stepsToReproduce as string[])
    : [];

  const stepsText =
    steps.length > 0
      ? steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "_Not specified_";

  const embed = new EmbedBuilder()
    .setTitle(`🐞 ${issue.issueId} — ${issue.title}`)
    .setColor(STATUS_COLOR[issue.status])
    .addFields(
      {
        name: "Status",
        value: STATUS_BADGE[issue.status],
        inline: true,
      },
      {
        name: "Severity",
        value: SEVERITY_LABEL[issue.severity],
        inline: true,
      },
      {
        name: "Category",
        value: issue.category,
        inline: true,
      },
      {
        name: "Reporter",
        value: `<@${issue.reporterDiscordId}>`,
        inline: true,
      },
      {
        name: "Summary",
        value: issue.summary,
      },
      {
        name: "Steps to Reproduce",
        value: stepsText,
      }
    )
    .setTimestamp(issue.createdAt)
    .setFooter({ text: issue.issueId });

  if (issue.attachments.length > 0) {
    // Show the first image inline; list the rest
    embed.setImage(issue.attachments[0].url);
    if (issue.attachments.length > 1) {
      embed.addFields({
        name: "Additional Attachments",
        value: issue.attachments
          .slice(1)
          .map((a, i) => `[${a.filename || `Screenshot ${i + 2}`}](${a.url})`)
          .join("\n"),
      });
    }
  }

  return embed;
}

// ─── Button row builder ───────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set<Status>([Status.RESOLVED, Status.CLOSED, Status.REJECTED]);

export function buildActionRow(issue: Issue): ActionRowBuilder<ButtonBuilder> {
  const isTerminal = TERMINAL_STATUSES.has(issue.status);

  const acknowledge = new ButtonBuilder()
    .setCustomId(buildButtonId("acknowledge", issue.issueId))
    .setLabel("Acknowledge")
    .setEmoji("👀")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(isTerminal || issue.status !== Status.BACKLOG);

  const start = new ButtonBuilder()
    .setCustomId(buildButtonId("start", issue.issueId))
    .setLabel("Start Work")
    .setEmoji("🛠️")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(
      isTerminal ||
        issue.status === Status.IN_PROGRESS ||
        issue.status === Status.QA
    );

  const qa = new ButtonBuilder()
    .setCustomId(buildButtonId("qa", issue.issueId))
    .setLabel("Send to QA")
    .setEmoji("🧪")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(isTerminal || issue.status === Status.QA);

  const resolve = new ButtonBuilder()
    .setCustomId(buildButtonId("resolve", issue.issueId))
    .setLabel("Resolve")
    .setEmoji("✅")
    .setStyle(ButtonStyle.Success)
    .setDisabled(isTerminal);

  const reject = new ButtonBuilder()
    .setCustomId(buildButtonId("reject", issue.issueId))
    .setLabel("Reject")
    .setEmoji("❌")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(isTerminal);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    acknowledge,
    start,
    qa,
    resolve,
    reject
  );
}
