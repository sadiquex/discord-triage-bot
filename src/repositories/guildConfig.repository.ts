import { PrismaClient } from "@prisma/client";
import type { GuildConfig, GuildConfigInput } from "../types";

export class GuildConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByGuildId(guildId: string): Promise<GuildConfig | null> {
    return this.prisma.guildConfig.findUnique({ where: { guildId } });
  }

  async upsert(data: GuildConfigInput): Promise<GuildConfig> {
    return this.prisma.guildConfig.upsert({
      where: { guildId: data.guildId },
      create: data,
      update: {
        issuePrefix: data.issuePrefix,
        channelIssueTracker: data.channelIssueTracker,
        channelTriaged: data.channelTriaged,
        channelInProgress: data.channelInProgress,
        channelQa: data.channelQa,
        channelResolved: data.channelResolved,
        channelReleaseNotes: data.channelReleaseNotes,
      },
    });
  }
}
