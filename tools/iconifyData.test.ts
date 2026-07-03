/* eslint-disable vite-plus/prefer-vite-plus-imports */
import { describe, expect, it } from "vitest";
import { buildGeneratedDataIndex, buildGlobalSearchIndex, shardCollection } from "./iconifyData.ts";

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
    expect(sharded.manifest.chunks).toMatchObject([
      { id: 0, hash: expect.stringMatching(/^[0-9a-f]{12}$/), iconCount: 1, aliasCount: 0 },
      { id: 1, hash: expect.stringMatching(/^[0-9a-f]{12}$/), iconCount: 1, aliasCount: 2 },
    ]);
    expect(sharded.manifest.chunks[0].file).toBe(`chunk-0.${sharded.manifest.chunks[0].hash}.json`);
    expect(sharded.manifest.chunks[1].file).toBe(`chunk-1.${sharded.manifest.chunks[1].hash}.json`);
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
      version: 4,
      entryCount: 3,
      prefixCount: 2,
      normalization: "lowercase-substring",
      entriesHash: expect.stringMatching(/^[0-9a-f]{12}$/),
      entriesFile: expect.any(String),
    });
    expect(searchIndex.manifest.entriesFile).toBe(
      `entries.${searchIndex.manifest.entriesHash}.json`,
    );
    expect(searchIndex.entries.prefixes).toEqual(["alpha", "beta"]);
    expect(searchIndex.entries.names).toEqual(["bell", "bell-alt", "cloud"]);
    expect(searchIndex.entries.runs).toEqual([
      [0, 1, 0, 0, 0],
      [1, 1, 0, 0, 1],
      [2, 1, 1, 0, 0],
    ]);
  });

  it("builds a stable top-level index for hashed assets", () => {
    const index = buildGeneratedDataIndex(
      { path: "/iconify-data/collections.aaaa1111bbbb.json", hash: "aaaa1111bbbb" },
      { path: "/iconify-data/search/manifest.cccc2222dddd.json", hash: "cccc2222dddd" },
      {
        beta: {
          manifest: {
            path: "/iconify-data/collections/beta/manifest.eeee3333ffff.json",
            hash: "eeee3333ffff",
          },
          chunks: [
            {
              path: "/iconify-data/collections/beta/chunk-0.999988887777.json",
              hash: "999988887777",
            },
          ],
        },
        alpha: {
          manifest: {
            path: "/iconify-data/collections/alpha/manifest.111122223333.json",
            hash: "111122223333",
          },
          chunks: [
            {
              path: "/iconify-data/collections/alpha/chunk-0.444455556666.json",
              hash: "444455556666",
            },
          ],
        },
      },
      [{ path: "/iconify-data/search/entries.abcdabcdabcd.json", hash: "abcdabcdabcd" }],
    );

    expect(index).toEqual({
      version: 4,
      collectionCount: 2,
      collections: {
        path: "/iconify-data/collections.aaaa1111bbbb.json",
        hash: "aaaa1111bbbb",
      },
      search: {
        manifest: {
          path: "/iconify-data/search/manifest.cccc2222dddd.json",
          hash: "cccc2222dddd",
        },
      },
      collectionManifests: {
        alpha: {
          path: "/iconify-data/collections/alpha/manifest.111122223333.json",
          hash: "111122223333",
        },
        beta: {
          path: "/iconify-data/collections/beta/manifest.eeee3333ffff.json",
          hash: "eeee3333ffff",
        },
      },
      assets: [
        {
          path: "/iconify-data/collections.aaaa1111bbbb.json",
          hash: "aaaa1111bbbb",
        },
        {
          path: "/iconify-data/collections/alpha/chunk-0.444455556666.json",
          hash: "444455556666",
        },
        {
          path: "/iconify-data/collections/alpha/manifest.111122223333.json",
          hash: "111122223333",
        },
        {
          path: "/iconify-data/collections/beta/chunk-0.999988887777.json",
          hash: "999988887777",
        },
        {
          path: "/iconify-data/collections/beta/manifest.eeee3333ffff.json",
          hash: "eeee3333ffff",
        },
        {
          path: "/iconify-data/search/entries.abcdabcdabcd.json",
          hash: "abcdabcdabcd",
        },
        {
          path: "/iconify-data/search/manifest.cccc2222dddd.json",
          hash: "cccc2222dddd",
        },
      ],
    });
  });
});
