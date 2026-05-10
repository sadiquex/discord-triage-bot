import { PrismaClient } from "@prisma/client";

export async function generateIssueId(
  prisma: PrismaClient,
  guildId: string,
  prefix: string
): Promise<string> {
  const count = await prisma.issue.count({
    where: {
      guildId,
      issueId: { startsWith: `${prefix}-` },
    },
  });
  const number = String(count + 1).padStart(3, "0");
  return `${prefix}-${number}`;
}
