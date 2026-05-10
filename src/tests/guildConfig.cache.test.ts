import { GuildConfigCache } from "../services/guildConfig.cache";
import type { GuildConfig } from "../types";

const makeConfig = (guildId: string): GuildConfig => ({
  guildId,
  issuePrefix: "COM",
  channelIssueTracker: "111",
  channelTriaged: "222",
  channelInProgress: "333",
  channelQa: "444",
  channelResolved: "555",
  channelReleaseNotes: "666",
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("GuildConfigCache", () => {
  let cache: GuildConfigCache;

  beforeEach(() => {
    cache = new GuildConfigCache();
  });

  it("returns null for unknown guild", () => {
    expect(cache.get("unknown")).toBeNull();
  });

  it("returns config after set", () => {
    const config = makeConfig("guild-1");
    cache.set("guild-1", config);
    expect(cache.get("guild-1")).toEqual(config);
  });

  it("returns null after invalidate", () => {
    const config = makeConfig("guild-2");
    cache.set("guild-2", config);
    cache.invalidate("guild-2");
    expect(cache.get("guild-2")).toBeNull();
  });

  it("expires entries after TTL", () => {
    cache = new GuildConfigCache(50); // 50ms TTL
    const config = makeConfig("guild-3");
    cache.set("guild-3", config);
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(cache.get("guild-3")).toBeNull();
        resolve();
      }, 100)
    );
  });
});
