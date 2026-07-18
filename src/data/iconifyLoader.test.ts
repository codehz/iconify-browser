/* eslint-disable vite-plus/prefer-vite-plus-imports */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderIconHTML } from "../utils/iconRenderer";
import {
  loadCollection,
  loadCollectionChunk,
  loadCollectionManifest,
  loadGlobalSearchIndex,
  loadIconBySearchHit,
  resetIconifyLoaderCaches,
  searchGlobalSearchIndex,
  searchIcons,
} from "./iconifyLoader";

function createJsonResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

async function waitForCondition(predicate: () => boolean, attempts = 20): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return;
    }

    await Promise.resolve();
  }

  throw new Error("Condition not met in time");
}

describe("iconifyLoader", () => {
  beforeEach(() => {
    resetIconifyLoaderCaches();
    vi.unstubAllGlobals();
  });

  it("loads and merges a full collection using structured chunk metadata", async () => {
    const manifestPath = "/iconify-data/collections/demo/manifest.aaaabbbbcccc.json";
    const chunk0Path = "/iconify-data/collections/demo/chunk-0.ddddeeeeffff.json";
    const chunk1Path = "/iconify-data/collections/demo/chunk-1.111122223333.json";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/index.json")) {
        return createJsonResponse({
          version: 4,
          collectionCount: 1,
          collections: {
            path: "/iconify-data/collections.123456789abc.json",
            hash: "123456789abc",
          },
          search: {
            manifest: {
              path: "/iconify-data/search/manifest.abcdefabcdef.json",
              hash: "abcdefabcdef",
            },
          },
          collectionManifests: {
            demo: {
              path: manifestPath,
              hash: "aaaabbbbcccc",
            },
          },
          assets: [],
        });
      }

      if (url.endsWith(manifestPath)) {
        return createJsonResponse({
          version: 4,
          prefix: "demo",
          iconCount: 2,
          aliasCount: 1,
          base: { width: 24, height: 24 },
          chunks: [
            {
              id: 0,
              file: "chunk-0.ddddeeeeffff.json",
              hash: "ddddeeeeffff",
              iconCount: 1,
              aliasCount: 0,
            },
            {
              id: 1,
              file: "chunk-1.111122223333.json",
              hash: "111122223333",
              iconCount: 1,
              aliasCount: 1,
            },
          ],
        });
      }

      if (url.endsWith(chunk0Path)) {
        return createJsonResponse({
          icons: {
            home: { body: "<path d='M0 0h24v24H0z' />" },
          },
        });
      }

      if (url.endsWith(chunk1Path)) {
        return createJsonResponse({
          icons: {
            user: { body: "<circle cx='12' cy='12' r='6' />" },
          },
          aliases: {
            "user-alt": { parent: "user", hFlip: true },
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const manifest = await loadCollectionManifest("demo");
    const chunk = await loadCollectionChunk("demo", 1, { manifest });
    const collection = await loadCollection("demo");

    expect(manifest.chunks).toHaveLength(2);
    expect(chunk.aliases?.["user-alt"]).toEqual({ parent: "user", hFlip: true });
    expect(Object.keys(collection.icons)).toEqual(["home", "user"]);
    expect(collection.aliases?.["user-alt"]).toEqual({ parent: "user", hFlip: true });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("loads a single chunk for a search hit and keeps it renderable", async () => {
    const manifestPath = "/iconify-data/collections/demo/manifest.aaaa1111bbbb.json";
    const chunkPath = "/iconify-data/collections/demo/chunk-0.cccc2222dddd.json";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/index.json")) {
        return createJsonResponse({
          version: 4,
          collectionCount: 1,
          collections: {
            path: "/iconify-data/collections.123456789abc.json",
            hash: "123456789abc",
          },
          search: {
            manifest: {
              path: "/iconify-data/search/manifest.abcdefabcdef.json",
              hash: "abcdefabcdef",
            },
          },
          collectionManifests: {
            demo: {
              path: manifestPath,
              hash: "aaaa1111bbbb",
            },
          },
          assets: [],
        });
      }

      if (url.endsWith(manifestPath)) {
        return createJsonResponse({
          version: 4,
          prefix: "demo",
          iconCount: 1,
          aliasCount: 1,
          base: { width: 24, height: 24 },
          chunks: [
            {
              id: 0,
              file: "chunk-0.cccc2222dddd.json",
              hash: "cccc2222dddd",
              iconCount: 1,
              aliasCount: 1,
            },
          ],
        });
      }

      if (url.endsWith(chunkPath)) {
        return createJsonResponse({
          icons: {
            user: {
              body: "<path d='M12 2a5 5 0 0 1 0 10a5 5 0 0 1 0-10m0 12c4 0 8 2 8 4v4H4v-4c0-2 4-4 8-4' />",
            },
          },
          aliases: {
            "user-alt": { parent: "user" },
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const collection = await loadIconBySearchHit("demo", 0);

    expect(Object.keys(collection.icons)).toEqual(["user"]);
    expect(collection.aliases?.["user-alt"]).toEqual({ parent: "user" });
    expect(renderIconHTML(collection, "user-alt")).toContain("<svg");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reuses manifest and chunk caches across repeated search-hit loads", async () => {
    const manifestPath = "/iconify-data/collections/demo/manifest.123412341234.json";
    const chunkPath = "/iconify-data/collections/demo/chunk-0.567856785678.json";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/index.json")) {
        return createJsonResponse({
          version: 4,
          collectionCount: 1,
          collections: {
            path: "/iconify-data/collections.123456789abc.json",
            hash: "123456789abc",
          },
          search: {
            manifest: {
              path: "/iconify-data/search/manifest.abcdefabcdef.json",
              hash: "abcdefabcdef",
            },
          },
          collectionManifests: {
            demo: {
              path: manifestPath,
              hash: "123412341234",
            },
          },
          assets: [],
        });
      }

      if (url.endsWith(manifestPath)) {
        return createJsonResponse({
          version: 4,
          prefix: "demo",
          iconCount: 1,
          aliasCount: 0,
          base: { width: 24, height: 24 },
          chunks: [
            {
              id: 0,
              file: "chunk-0.567856785678.json",
              hash: "567856785678",
              iconCount: 1,
              aliasCount: 0,
            },
          ],
        });
      }

      if (url.endsWith(chunkPath)) {
        return createJsonResponse({
          icons: {
            bell: { body: "<path d='M12 2l4 8H8z' />" },
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const first = await loadIconBySearchHit("demo", 0);
    const second = await loadIconBySearchHit("demo", 0);

    expect(first.icons.bell).toEqual(second.icons.bell);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps a shared search-hit load alive when another consumer aborts", async () => {
    const manifestResponse = {
      version: 4,
      prefix: "demo",
      iconCount: 1,
      aliasCount: 0,
      base: { width: 24, height: 24 },
      chunks: [
        {
          id: 0,
          file: "chunk-0.777788889999.json",
          hash: "777788889999",
          iconCount: 1,
          aliasCount: 0,
        },
      ],
    };
    const chunkResponse = {
      icons: {
        bell: { body: "<path d='M12 2l4 8H8z' />" },
      },
    };
    const manifestPath = "/iconify-data/collections/demo/manifest.222233334444.json";
    const chunkPath = "/iconify-data/collections/demo/chunk-0.777788889999.json";

    const manifestRequest = {
      resolve: null as (() => void) | null,
    };

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/index.json")) {
        return Promise.resolve(
          createJsonResponse({
            version: 4,
            collectionCount: 1,
            collections: {
              path: "/iconify-data/collections.123456789abc.json",
              hash: "123456789abc",
            },
            search: {
              manifest: {
                path: "/iconify-data/search/manifest.abcdefabcdef.json",
                hash: "abcdefabcdef",
              },
            },
            collectionManifests: {
              demo: {
                path: manifestPath,
                hash: "222233334444",
              },
            },
            assets: [],
          }),
        );
      }

      if (url.endsWith(manifestPath)) {
        return new Promise<Response>((resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }

          manifestRequest.resolve = () => resolve(createJsonResponse(manifestResponse));
        });
      }

      if (url.endsWith(chunkPath)) {
        return Promise.resolve(createJsonResponse(chunkResponse));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const firstController = new AbortController();
    const secondController = new AbortController();

    const firstLoad = loadIconBySearchHit("demo", 0, { signal: firstController.signal });
    const secondLoad = loadIconBySearchHit("demo", 0, { signal: secondController.signal });

    await waitForCondition(() => typeof manifestRequest.resolve === "function");
    firstController.abort();
    if (manifestRequest.resolve) {
      manifestRequest.resolve();
    }

    await expect(firstLoad).rejects.toThrow(/Aborted/);
    await expect(secondLoad).resolves.toMatchObject({
      prefix: "demo",
      icons: {
        bell: { body: "<path d='M12 2l4 8H8z' />" },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("searches the global index with case-insensitive substring matching", async () => {
    const searchManifestPath = "/iconify-data/search/manifest.101010101010.json";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/index.json")) {
        return createJsonResponse({
          version: 4,
          collectionCount: 0,
          collections: {
            path: "/iconify-data/collections.123456789abc.json",
            hash: "123456789abc",
          },
          search: {
            manifest: {
              path: searchManifestPath,
              hash: "101010101010",
            },
          },
          collectionManifests: {},
          assets: [],
        });
      }

      if (url.endsWith(searchManifestPath)) {
        return createJsonResponse({
          version: 4,
          entryCount: 3,
          prefixCount: 2,
          normalization: "lowercase-substring",
          entriesFile: "entries.202020202020.json",
          entriesHash: "202020202020",
        });
      }

      if (url.endsWith("/search/entries.202020202020.json")) {
        return createJsonResponse({
          prefixes: ["alpha", "beta"],
          names: ["Bell", "bell-alt", "cloud"],
          runs: [
            [0, 1, 0, 1, 0],
            [1, 1, 0, 1, 1],
            [2, 1, 1, 0, 0],
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const index = await loadGlobalSearchIndex();
    const directHits = searchGlobalSearchIndex(index, "ELL");
    const asyncHits = await searchIcons("ell");
    const emptyHits = await searchIcons("   ");
    const limitedHits = searchGlobalSearchIndex(index, "ell", 1);
    const prefixHits = searchGlobalSearchIndex(
      index,
      "ell",
      Number.POSITIVE_INFINITY,
      new Set(["beta"]),
    );
    const emptyPrefixHits = await searchIcons("ell", 10, { prefixes: new Set(["missing"]) });

    expect(directHits).toEqual([
      { prefix: "alpha", name: "Bell", chunkId: 1, isAlias: false },
      { prefix: "alpha", name: "bell-alt", chunkId: 1, isAlias: true },
    ]);
    expect(asyncHits).toEqual(directHits);
    expect(emptyHits).toEqual([]);
    expect(limitedHits).toEqual([{ prefix: "alpha", name: "Bell", chunkId: 1, isAlias: false }]);
    expect(prefixHits).toEqual([]);
    expect(emptyPrefixHits).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
