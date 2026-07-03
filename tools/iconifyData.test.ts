/* eslint-disable vite-plus/prefer-vite-plus-imports */
import { describe, expect, it } from "vitest";
import { buildGlobalSearchIndex, shardCollection } from "./iconifyData.ts";

describe("iconifyData generator", () => {
  it("creates structured chunk metadata and keeps aliases with their parent chunk", () => {
    const collection = {
      prefix: "demo",
      info: "fixture",
      icons: {
        home: { body: "<path />" },
        user: { body: "<circle />" },
      },
      aliases: {
        "user-alt": { parent: "user", rotate: 1 },
        "user-alt-2": { parent: "user-alt" },
      },
    };

    const sharded = shardCollection(collection, 1);
    const entryMap = new Map(
      sharded.searchEntries.map((entry) => [entry.name, entry.chunkId] as const),
    );

    expect(sharded.manifest.base).toMatchObject({
      prefix: "demo",
      info: "fixture",
    });
    expect(sharded.manifest.chunks).toEqual([
      { id: 0, file: "chunk-0.json", iconCount: 1, aliasCount: 0 },
      { id: 1, file: "chunk-1.json", iconCount: 1, aliasCount: 2 },
    ]);
    expect(entryMap.get("home")).toBe(0);
    expect(entryMap.get("user")).toBe(1);
    expect(entryMap.get("user-alt")).toBe(1);
    expect(entryMap.get("user-alt-2")).toBe(1);
  });

  it("builds a run-based global search index", () => {
    const alpha = shardCollection(
      {
        prefix: "alpha",
        icons: {
          bell: { body: "<path />" },
        },
        aliases: {
          "bell-alt": { parent: "bell" },
        },
      },
      1024,
    );
    const beta = shardCollection(
      {
        prefix: "beta",
        icons: {
          cloud: { body: "<path />" },
        },
      },
      1024,
    );

    const searchIndex = buildGlobalSearchIndex([beta, alpha]);

    expect(searchIndex.manifest).toEqual({
      version: 3,
      entryCount: 3,
      prefixCount: 2,
      normalization: "lowercase-substring",
      entriesFile: "entries.json",
    });
    expect(searchIndex.entries.prefixes).toEqual(["alpha", "beta"]);
    expect(searchIndex.entries.names).toEqual(["bell", "bell-alt", "cloud"]);
    expect(searchIndex.entries.runs).toEqual([
      [0, 1, 0, 0, 0],
      [1, 1, 0, 0, 1],
      [2, 1, 1, 0, 0],
    ]);
  });
});
