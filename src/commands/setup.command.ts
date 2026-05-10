import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const setupCommand = new SlashCommandBuilder()
  .setName("setup")
  .setDescription("Create issue tracker channels in this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt
      .setName("prefix")
      .setDescription("Issue ID prefix (e.g. COM → COM-001)")
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(8)
  );
