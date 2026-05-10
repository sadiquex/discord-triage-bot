import { PrismaClient, Status } from "@prisma/client";
import type { Issue } from "../types";
import type { CreateIssueInput, StatusActor } from "../types";

export class IssueRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateIssueInput): Promise<Issue> {
    return this.prisma.issue.create({
      data: {
        issueId: data.issueId,
        title: data.title,
        summary: data.summary,
        severity: data.severity,
        category: data.category,
        stepsToReproduce: data.stepsToReproduce,
        reporterDiscordId: data.reporterDiscordId,
        reporterName: data.reporterName,
        originalMsgId: data.originalMsgId,
        originalChannelId: data.originalChannelId,
        guildId: data.guildId,
        attachments: {
          create: data.attachments,
        },
      },
      include: { attachments: true, history: true },
    });
  }

  async findByOriginalMsgId(msgId: string): Promise<Issue | null> {
    return this.prisma.issue.findUnique({
      where: { originalMsgId: msgId },
      include: { attachments: true, history: true },
    });
  }

  async findByIssueId(issueId: string): Promise<Issue | null> {
    return this.prisma.issue.findUnique({
      where: { issueId },
      include: { attachments: true, history: true },
    });
  }

  async updateTriagedMessage(
    issueId: string,
    triagedMsgId: string,
    triagedChannelId: string,
    threadId: string
  ): Promise<Issue> {
    return this.prisma.issue.update({
      where: { issueId },
      data: { triagedMsgId, triagedChannelId, threadId },
      include: { attachments: true, history: true },
    });
  }

  async updateStatus(
    issueId: string,
    newStatus: Status,
    actor: StatusActor,
    note?: string
  ): Promise<Issue> {
    const current = await this.prisma.issue.findUniqueOrThrow({
      where: { issueId },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.issueHistory.create({
        data: {
          issueId: current.id,
          fromStatus: current.status,
          toStatus: newStatus,
          actorId: actor.id,
          actorName: actor.name,
          note,
        },
      });

      return tx.issue.update({
        where: { issueId },
        data: {
          status: newStatus,
          resolvedAt: newStatus === Status.RESOLVED ? new Date() : undefined,
        },
        include: { attachments: true, history: true },
      });
    });
  }

  async findUnreleased(guildId: string): Promise<Issue[]> {
    return this.prisma.issue.findMany({
      where: { guildId, status: Status.RESOLVED, releaseId: null },
      include: { attachments: true, history: true },
      orderBy: { resolvedAt: "asc" },
    });
  }

  async attachToRelease(issueIds: string[], releaseId: string): Promise<void> {
    await this.prisma.issue.updateMany({
      where: { issueId: { in: issueIds } },
      data: { releaseId, status: Status.CLOSED },
    });
  }
}
