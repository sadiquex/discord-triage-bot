import type { GuildConfig } from "../types";

interface CacheEntry {
  config: GuildConfig;
  expiresAt: number;
}

export class GuildConfigCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  get(guildId: string): GuildConfig | null {
    const entry = this.cache.get(guildId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(guildId);
      return null;
    }
    return entry.config;
  }

  set(guildId: string, config: GuildConfig): void {
    this.cache.set(guildId, { config, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(guildId: string): void {
    this.cache.delete(guildId);
  }
}
