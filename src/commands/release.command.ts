import { SlashCommandBuilder } from "discord.js";

export const releaseCommand = new SlashCommandBuilder()
  .setName("release")
  .setDescription("Generate release notes from resolved issues and post to #release-notes")
  .addStringOption((option) =>
    option
      .setName("version")
      .setDescription("Release version (e.g. v1.2.3)")
      .setRequired(true)
  );
