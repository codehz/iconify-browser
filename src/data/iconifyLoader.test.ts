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

describe("iconifyLoader", () => {
  beforeEach(() => {
    resetIconifyLoaderCaches();
    vi.unstubAllGlobals();
  });

  it("loads and merges a full collection using structured chunk metadata", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/collections/demo/manifest.json")) {
        return createJsonResponse({
          version: 2,
          prefix: "demo",
          iconCount: 2,
          aliasCount: 1,
          base: { width: 24, height: 24 },
          chunks: [
            { id: 0, file: "chunk-0.json", iconCount: 1, aliasCount: 0 },
            { id: 1, file: "chunk-1.json", iconCount: 1, aliasCount: 1 },
          ],
        });
      }

      if (url.endsWith("/collections/demo/chunk-0.json")) {
        return createJsonResponse({
          icons: {
            home: { body: "<path d='M0 0h24v24H0z' />" },
          },
        });
      }

      if (url.endsWith("/collections/demo/chunk-1.json")) {
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
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("loads a single chunk for a search hit and keeps it renderable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = getRequestUrl(input);

        if (url.endsWith("/collections/demo/manifest.json")) {
          return createJsonResponse({
            version: 2,
            prefix: "demo",
            iconCount: 1,
            aliasCount: 1,
            base: { width: 24, height: 24 },
            chunks: [{ id: 0, file: "chunk-0.json", iconCount: 1, aliasCount: 1 }],
          });
        }

        if (url.endsWith("/collections/demo/chunk-0.json")) {
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
      }),
    );

    const collection = await loadIconBySearchHit("demo", 0);

    expect(Object.keys(collection.icons)).toEqual(["user"]);
    expect(collection.aliases?.["user-alt"]).toEqual({ parent: "user" });
    expect(renderIconHTML(collection, "user-alt")).toContain("<svg");
  });

  it("searches the global index with case-insensitive substring matching", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = getRequestUrl(input);

      if (url.endsWith("/search/manifest.json")) {
        return createJsonResponse({
          version: 2,
          entryCount: 3,
          prefixCount: 2,
          normalization: "lowercase-substring",
          entriesFile: "entries.json",
        });
      }

      if (url.endsWith("/search/entries.json")) {
        return createJsonResponse({
          prefixes: ["alpha", "beta"],
          names: ["Bell", "bell-alt", "cloud"],
          prefixIds: [0, 0, 1],
          chunkIds: [1, 1, 0],
          aliasFlags: [0, 1, 0],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const index = await loadGlobalSearchIndex();
    const directHits = searchGlobalSearchIndex(index, "ELL");
    const asyncHits = await searchIcons("ell");
    const emptyHits = await searchIcons("   ");

    expect(directHits).toEqual([
      { prefix: "alpha", name: "Bell", chunkId: 1, isAlias: false },
      { prefix: "alpha", name: "bell-alt", chunkId: 1, isAlias: true },
    ]);
    expect(asyncHits).toEqual(directHits);
    expect(emptyHits).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
