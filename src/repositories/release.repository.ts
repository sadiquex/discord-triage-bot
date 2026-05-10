import { PrismaClient } from "@prisma/client";
import type { Release } from "../types";

export class ReleaseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    version: string;
    notes: string;
    postedBy: string;
  }): Promise<Release> {
    return this.prisma.release.create({ data });
  }

  async findByVersion(version: string): Promise<Release | null> {
    return this.prisma.release.findUnique({ where: { version } });
  }

  async findAll(): Promise<Release[]> {
    return this.prisma.release.findMany({ orderBy: { postedAt: "desc" } });
  }
}
