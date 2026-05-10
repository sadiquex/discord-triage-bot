import { Client, Message, TextChannel } from "discord.js";
import { Status } from "@prisma/client";
import { logger } from "../utils/logger";
import { buildIssueEmbed, buildActionRow } from "./formatter.service";
import type { ThreadService } from "./thread.service";
import type { IssueRepository } from "../repositories/issue.repository";
import type { Issue, ParsedIssue, CreateIssueInput, StatusActor, GuildConfig } from "../types";
import type { ButtonInteraction } from "discord.js";

export class IssueService {
  constructor(
    private readonly client: Client,
    private readonly issueRepo: IssueRepository,
    private readonly threadService: ThreadService
  ) {}

  async createIssue(
    parsed: ParsedIssue,
    originalMessage: Message,
    issueId: string,
    config: GuildConfig
  ): Promise<Issue> {
    const attachments = [...originalMessage.attachments.values()].map((a) => ({
      url: a.url,
      filename: a.name,
      contentType: a.contentType ?? undefined,
    }));

    const input: CreateIssueInput = {
      issueId,
      title: parsed.title,
      summary: parsed.summary,
      severity: parsed.severity,
      category: parsed.category,
      stepsToReproduce: parsed.stepsToReproduce,
      reporterDiscordId: originalMessage.author.id,
      reporterName: originalMessage.author.username,
      originalMsgId: originalMessage.id,
      originalChannelId: originalMessage.channelId,
      guildId: originalMessage.guildId!,
      attachments,
    };

    let issue = await this.issueRepo.create(input);

    const triagedChannel = (await this.client.channels.fetch(
      config.channelTriaged
    )) as TextChannel;

    const embed = buildIssueEmbed(issue as Issue & { attachments: { url: string; filename: string }[] });
    const row = buildActionRow(issue);

    const triagedMsg = await triagedChannel.send({ embeds: [embed], components: [row] });

    const threadId = await this.threadService.createThread(triagedMsg, issueId);

    issue = await this.issueRepo.updateTriagedMessage(
      issueId,
      triagedMsg.id,
      triagedChannel.id,
      threadId
    );

    await originalMessage.reply(
      `✅ Triaged as **${issueId}** → ${triagedMsg.url}\n💬 Discussion: <#${threadId}>`
    );

    logger.info({ issueId, triagedMsgId: triagedMsg.id }, "Issue created and triaged");
    return issue;
  }

  async updateStatus(
    interaction: ButtonInteraction,
    issueId: string,
    newStatus: Status,
    actor: StatusActor,
    config: GuildConfig
  ): Promise<void> {
    const updatedIssue = await this.issueRepo.updateStatus(issueId, newStatus, actor);

    if (updatedIssue.triagedMsgId && updatedIssue.triagedChannelId) {
      const channel = (await this.client.channels.fetch(
        updatedIssue.triagedChannelId
      )) as TextChannel;
      const triagedMsg = await channel.messages.fetch(updatedIssue.triagedMsgId);
      const embed = buildIssueEmbed(
        updatedIssue as Issue & { attachments: { url: string; filename: string }[] }
      );
      const row = buildActionRow(updatedIssue);
      await triagedMsg.edit({ embeds: [embed], components: [row] });
    }

    const workflowChannelId = getWorkflowChannelId(newStatus, config);
    if (workflowChannelId) {
      const workflowChannel = (await this.client.channels.fetch(workflowChannelId)) as TextChannel;

      const statusEmoji: Record<string, string> = {
        [Status.IN_PROGRESS]: "🛠️",
        [Status.QA]: "🧪",
        [Status.RESOLVED]: "✅",
      };

      const emoji = statusEmoji[newStatus] ?? "🔄";
      const jumpUrl =
        updatedIssue.triagedMsgId && updatedIssue.triagedChannelId
          ? `https://discord.com/channels/${updatedIssue.guildId}/${updatedIssue.triagedChannelId}/${updatedIssue.triagedMsgId}`
          : "";

      await workflowChannel.send(
        `${emoji} **${issueId}** — ${updatedIssue.title}\nUpdated by <@${actor.id}>${jumpUrl ? ` → [Jump to issue](${jumpUrl})` : ""}`
      );
    }

    logger.info({ issueId, newStatus, actor: actor.name }, "Issue status updated");
  }
}

function getWorkflowChannelId(status: Status, config: GuildConfig): string | undefined {
  const map: Partial<Record<Status, string>> = {
    [Status.IN_PROGRESS]: config.channelInProgress,
    [Status.QA]: config.channelQa,
    [Status.RESOLVED]: config.channelResolved,
  };
  return map[status];
}
