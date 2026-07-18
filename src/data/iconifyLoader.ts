import type { IconifyJSON } from "@iconify/types";
import type {
  CollectionChunk,
  CollectionManifest,
  GlobalSearchHit,
  IconifyDataIndex,
  GlobalSearchIndex,
  GlobalSearchIndexEntries,
  GlobalSearchIndexManifest,
  GlobalSearchRun,
} from "../types";

import { LruCache } from "../utils/lruCache";

const DATA_INDEX_URL = "/iconify-data/index.json";
/** Default cap for global search results to keep UI/main-thread work bounded. */
export const DEFAULT_GLOBAL_SEARCH_LIMIT = 400;
/** Yield to the browser event loop after scanning this many name entries. */
const GLOBAL_SEARCH_YIELD_BATCH = 8_000;
/** Bound in-memory manifests; less critical than chunks but still unbounded before. */
const MANIFEST_CACHE_MAX_ENTRIES = 96;
/**
 * Bound decoded chunk JSON in the main thread.
 * Service Worker has its own immutable cache maxEntries (640).
 */
const CHUNK_CACHE_MAX_ENTRIES = 256;

let iconifyDataIndexCache: IconifyDataIndex | null = null;
let iconifyDataIndexPromise: Promise<IconifyDataIndex> | null = null;
const manifestCache = new LruCache<CollectionManifest>(MANIFEST_CACHE_MAX_ENTRIES);
const manifestPromiseCache = new Map<string, Promise<CollectionManifest>>();
const chunkCache = new LruCache<CollectionChunk>(CHUNK_CACHE_MAX_ENTRIES);
const chunkPromiseCache = new Map<string, Promise<CollectionChunk>>();
let globalSearchIndexCache: GlobalSearchIndex | null = null;
let globalSearchIndexPromise: Promise<GlobalSearchIndex> | null = null;
const loweredNamesCache = new WeakMap<GlobalSearchIndex, string[]>();

interface LoadOptions {
  signal?: AbortSignal;
}

function getLoweredNames(index: GlobalSearchIndex): string[] {
  const cached = loweredNamesCache.get(index);
  if (cached) {
    return cached;
  }

  const lowered = index.names.map((name) => name.toLowerCase());
  loweredNamesCache.set(index, lowered);
  return lowered;
}

function yieldToMainThread(): Promise<void> {
  const schedulerWithYield = (
    globalThis as typeof globalThis & {
      scheduler?: { yield?: () => Promise<void> };
    }
  ).scheduler;

  if (typeof schedulerWithYield?.yield === "function") {
    return schedulerWithYield.yield();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  assertNotAborted(signal);

  if (!signal) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      signal.removeEventListener("abort", handleAbort);
    };

    signal.addEventListener("abort", handleAbort, { once: true });

    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`加载资源失败: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function loadIconifyDataIndex(options?: LoadOptions): Promise<IconifyDataIndex> {
  if (iconifyDataIndexCache) {
    return withAbort(Promise.resolve(iconifyDataIndexCache), options?.signal);
  }

  if (iconifyDataIndexPromise) {
    return withAbort(iconifyDataIndexPromise, options?.signal);
  }

  const promise = fetchJson<IconifyDataIndex>(DATA_INDEX_URL)
    .then((index) => {
      iconifyDataIndexPromise = null;
      iconifyDataIndexCache = index;
      return index;
    })
    .catch((error: unknown) => {
      iconifyDataIndexPromise = null;
      throw error;
    });

  iconifyDataIndexPromise = promise;
  return withAbort(promise, options?.signal);
}

export function mergeCollection(
  manifest: CollectionManifest,
  chunks: CollectionChunk[],
): IconifyJSON {
  const icons: NonNullable<IconifyJSON["icons"]> = {};
  const aliases: NonNullable<IconifyJSON["aliases"]> = {};

  for (const chunk of chunks) {
    Object.assign(icons, chunk.icons);

    if (chunk.aliases) {
      Object.assign(aliases, chunk.aliases);
    }
  }

  const collection: IconifyJSON = {
    ...manifest.base,
    prefix: manifest.prefix,
    icons,
  };

  if (Object.keys(aliases).length > 0) {
    collection.aliases = aliases;
  }

  return collection;
}

export function createCollectionFromChunk(
  manifest: CollectionManifest,
  chunk: CollectionChunk,
): IconifyJSON {
  return mergeCollection(manifest, [chunk]);
}

export async function loadCollectionManifest(
  prefix: string,
  options?: LoadOptions,
): Promise<CollectionManifest> {
  const cached = manifestCache.get(prefix);
  if (cached) {
    return withAbort(Promise.resolve(cached), options?.signal);
  }

  const pending = manifestPromiseCache.get(prefix);
  if (pending) {
    return withAbort(pending, options?.signal);
  }

  const promise = loadIconifyDataIndex()
    .then((index) => {
      const manifestAsset = index.collectionManifests[prefix];
      if (!manifestAsset) {
        throw new Error(`未找到图标包清单: ${prefix}`);
      }

      return fetchJson<CollectionManifest>(manifestAsset.path);
    })
    .then((manifest) => {
      manifestPromiseCache.delete(prefix);
      manifestCache.set(prefix, manifest);
      return manifest;
    })
    .catch((error: unknown) => {
      manifestPromiseCache.delete(prefix);
      throw error;
    });

  manifestPromiseCache.set(prefix, promise);
  return withAbort(promise, options?.signal);
}

export async function loadCollectionChunk(
  prefix: string,
  chunkId: number,
  options?: LoadOptions & { manifest?: CollectionManifest },
): Promise<CollectionChunk> {
  const chunkKey = `${prefix}:${chunkId}`;
  const cached = chunkCache.get(chunkKey);
  if (cached) {
    return withAbort(Promise.resolve(cached), options?.signal);
  }

  const pending = chunkPromiseCache.get(chunkKey);
  if (pending) {
    return withAbort(pending, options?.signal);
  }

  const promise = (async () => {
    const manifest = options?.manifest ?? (await loadCollectionManifest(prefix));
    const chunkMeta = manifest.chunks.find((chunk) => chunk.id === chunkId);

    if (!chunkMeta) {
      throw new Error(`未找到图标分片: ${prefix}#${chunkId}`);
    }

    const chunk = await fetchJson<CollectionChunk>(
      `/iconify-data/collections/${prefix}/${chunkMeta.file}`,
    );

    chunkPromiseCache.delete(chunkKey);
    chunkCache.set(chunkKey, chunk);
    return chunk;
  })().catch((error: unknown) => {
    chunkPromiseCache.delete(chunkKey);
    throw error;
  });

  chunkPromiseCache.set(chunkKey, promise);
  return withAbort(promise, options?.signal);
}

export async function loadCollection(prefix: string, options?: LoadOptions): Promise<IconifyJSON> {
  const manifest = await loadCollectionManifest(prefix, options);
  assertNotAborted(options?.signal);

  const chunks = await Promise.all(
    manifest.chunks.map((chunkMeta) =>
      loadCollectionChunk(prefix, chunkMeta.id, {
        manifest,
        signal: options?.signal,
      }),
    ),
  );
  assertNotAborted(options?.signal);

  return mergeCollection(manifest, chunks);
}

export async function loadGlobalSearchIndex(options?: LoadOptions): Promise<GlobalSearchIndex> {
  if (globalSearchIndexCache) {
    return withAbort(Promise.resolve(globalSearchIndexCache), options?.signal);
  }

  if (globalSearchIndexPromise) {
    return withAbort(globalSearchIndexPromise, options?.signal);
  }

  const promise = (async () => {
    const dataIndex = await loadIconifyDataIndex();
    const manifest = await fetchJson<GlobalSearchIndexManifest>(dataIndex.search.manifest.path);
    assertNotAborted(options?.signal);

    const entries = await fetchJson<GlobalSearchIndexEntries>(
      `/iconify-data/search/${manifest.entriesFile}`,
    );
    assertNotAborted(options?.signal);

    if (!isValidGlobalSearchRuns(entries.names.length, entries.runs, entries.prefixes.length)) {
      throw new Error("全局搜索索引结构损坏");
    }

    const index: GlobalSearchIndex = {
      ...manifest,
      ...entries,
    };

    globalSearchIndexPromise = null;
    globalSearchIndexCache = index;
    return index;
  })().catch((error: unknown) => {
    globalSearchIndexPromise = null;
    throw error;
  });

  globalSearchIndexPromise = promise;
  return withAbort(promise, options?.signal);
}

export function searchGlobalSearchIndex(
  index: GlobalSearchIndex,
  query: string,
  limit = Number.POSITIVE_INFINITY,
  prefixes?: Set<string>,
): GlobalSearchHit[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || limit <= 0) {
    return [];
  }

  const loweredNames = getLoweredNames(index);
  const hits: GlobalSearchHit[] = [];
  let runIndex = 0;
  let currentRun = index.runs[runIndex] ?? null;
  let currentRunEnd = currentRun ? currentRun[0] + currentRun[1] : 0;

  for (let indexOffset = 0; indexOffset < index.names.length; indexOffset += 1) {
    while (currentRun && indexOffset >= currentRunEnd) {
      runIndex += 1;
      currentRun = index.runs[runIndex] ?? null;
      currentRunEnd = currentRun ? currentRun[0] + currentRun[1] : 0;
    }

    if (!currentRun) {
      break;
    }

    if (!loweredNames[indexOffset].includes(normalizedQuery)) {
      continue;
    }

    const prefix = index.prefixes[currentRun[2]];

    if (prefixes && !prefixes.has(prefix)) {
      continue;
    }

    hits.push({
      prefix,
      name: index.names[indexOffset],
      chunkId: currentRun[3],
      isAlias: currentRun[4] === 1,
    });

    if (hits.length >= limit) {
      break;
    }
  }

  return hits;
}

export async function searchGlobalSearchIndexAsync(
  index: GlobalSearchIndex,
  query: string,
  limit = Number.POSITIVE_INFINITY,
  prefixes?: Set<string>,
  signal?: AbortSignal,
): Promise<GlobalSearchHit[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || limit <= 0) {
    return [];
  }

  assertNotAborted(signal);

  const loweredNames = getLoweredNames(index);
  const hits: GlobalSearchHit[] = [];
  let runIndex = 0;
  let currentRun = index.runs[runIndex] ?? null;
  let currentRunEnd = currentRun ? currentRun[0] + currentRun[1] : 0;
  let scannedSinceYield = 0;

  for (let indexOffset = 0; indexOffset < index.names.length; indexOffset += 1) {
    scannedSinceYield += 1;
    if (scannedSinceYield >= GLOBAL_SEARCH_YIELD_BATCH) {
      scannedSinceYield = 0;
      await yieldToMainThread();
      assertNotAborted(signal);
    }

    while (currentRun && indexOffset >= currentRunEnd) {
      runIndex += 1;
      currentRun = index.runs[runIndex] ?? null;
      currentRunEnd = currentRun ? currentRun[0] + currentRun[1] : 0;
    }

    if (!currentRun) {
      break;
    }

    if (!loweredNames[indexOffset].includes(normalizedQuery)) {
      continue;
    }

    const prefix = index.prefixes[currentRun[2]];

    if (prefixes && !prefixes.has(prefix)) {
      continue;
    }

    hits.push({
      prefix,
      name: index.names[indexOffset],
      chunkId: currentRun[3],
      isAlias: currentRun[4] === 1,
    });

    if (hits.length >= limit) {
      break;
    }
  }

  return hits;
}

export async function searchIcons(
  query: string,
  limit = DEFAULT_GLOBAL_SEARCH_LIMIT,
  options?: LoadOptions & { prefixes?: Set<string> },
): Promise<GlobalSearchHit[]> {
  if (!query.trim() || limit <= 0) {
    return [];
  }

  const index = await loadGlobalSearchIndex(options);
  assertNotAborted(options?.signal);
  return searchGlobalSearchIndexAsync(index, query, limit, options?.prefixes, options?.signal);
}

export async function loadIconBySearchHit(
  prefix: string,
  chunkId: number,
  options?: LoadOptions,
): Promise<IconifyJSON> {
  const manifest = await loadCollectionManifest(prefix, options);
  assertNotAborted(options?.signal);

  const chunk = await loadCollectionChunk(prefix, chunkId, {
    manifest,
    signal: options?.signal,
  });
  assertNotAborted(options?.signal);

  return createCollectionFromChunk(manifest, chunk);
}

export function resetIconifyLoaderCaches() {
  iconifyDataIndexCache = null;
  iconifyDataIndexPromise = null;
  manifestCache.clear();
  manifestPromiseCache.clear();
  chunkCache.clear();
  chunkPromiseCache.clear();
  globalSearchIndexCache = null;
  globalSearchIndexPromise = null;
}

export { isAbortError };

function isValidGlobalSearchRuns(nameCount: number, runs: GlobalSearchRun[], prefixCount: number) {
  if (nameCount === 0) {
    return runs.length === 0;
  }

  let expectedStart = 0;
  for (const run of runs) {
    const [start, length, prefixId, chunkId, aliasFlag] = run;
    if (start !== expectedStart || length <= 0) {
      return false;
    }

    if (prefixId < 0 || prefixId >= prefixCount || chunkId < 0) {
      return false;
    }

    if (aliasFlag !== 0 && aliasFlag !== 1) {
      return false;
    }

    expectedStart += length;
  }

  return expectedStart === nameCount;
}
