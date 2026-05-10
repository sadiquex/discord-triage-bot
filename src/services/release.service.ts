import { Client, TextChannel, EmbedBuilder, Colors } from "discord.js";
import { logger } from "../utils/logger";
import type { AiService } from "./ai.service";
import type { IssueRepository } from "../repositories/issue.repository";
import type { ReleaseRepository } from "../repositories/release.repository";
import type { Release, GuildConfig } from "../types";

export class ReleaseService {
  constructor(
    private readonly client: Client,
    private readonly ai: AiService,
    private readonly issueRepo: IssueRepository,
    private readonly releaseRepo: ReleaseRepository
  ) {}

  async generateAndPost(
    version: string,
    postedById: string,
    postedByName: string,
    config: GuildConfig
  ): Promise<{ release: Release; channelUrl: string }> {
    const unreleased = await this.issueRepo.findUnreleased(config.guildId);

    if (unreleased.length === 0) {
      throw new Error("No resolved issues available to release.");
    }

    const issueItems = unreleased.map((i) => ({
      issueId: i.issueId,
      title: i.title,
      category: i.category,
    }));

    const notes = await this.ai.generateReleaseNotes(version, issueItems);

    const existing = await this.releaseRepo.findByVersion(version);
    if (existing) {
      throw new Error(`Release ${version} already exists.`);
    }

    const release = await this.releaseRepo.create({
      version,
      notes,
      postedBy: postedByName,
    });

    await this.issueRepo.attachToRelease(
      unreleased.map((i) => i.issueId),
      release.id
    );

    const channel = (await this.client.channels.fetch(
      config.channelReleaseNotes
    )) as TextChannel;

    const embed = new EmbedBuilder()
      .setTitle(`🚀 Release ${version}`)
      .setDescription(notes)
      .setColor(Colors.Blurple)
      .addFields({ name: "Issues resolved", value: String(unreleased.length), inline: true })
      .setTimestamp()
      .setFooter({ text: `Released by ${postedByName}` });

    const msg = await channel.send({ embeds: [embed] });

    logger.info({ version, issueCount: unreleased.length }, "Release posted");

    return { release, channelUrl: msg.url };
  }
}
