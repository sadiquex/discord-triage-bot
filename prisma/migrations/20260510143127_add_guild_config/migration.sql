-- CreateTable
CREATE TABLE "GuildConfig" (
    "guildId" TEXT NOT NULL,
    "issuePrefix" TEXT NOT NULL,
    "channelIssueTracker" TEXT NOT NULL,
    "channelTriaged" TEXT NOT NULL,
    "channelInProgress" TEXT NOT NULL,
    "channelQa" TEXT NOT NULL,
    "channelResolved" TEXT NOT NULL,
    "channelReleaseNotes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildConfig_pkey" PRIMARY KEY ("guildId")
);
