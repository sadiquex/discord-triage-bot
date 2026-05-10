import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

export async function generateIssueId(prisma: PrismaClient): Promise<string> {
  const count = await prisma.issue.count();
  const number = String(count + 1).padStart(3, "0");
  return `${env.ISSUE_PREFIX}-${number}`;
}
