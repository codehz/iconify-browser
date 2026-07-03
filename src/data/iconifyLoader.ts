import type { IconifyJSON } from "@iconify/types";
import type {
  CollectionChunk,
  CollectionManifest,
  GlobalSearchHit,
  GlobalSearchIndex,
  GlobalSearchIndexEntries,
  GlobalSearchIndexManifest,
  GlobalSearchRun,
} from "../types";

const manifestCache = new Map<string, CollectionManifest>();
const manifestPromiseCache = new Map<string, Promise<CollectionManifest>>();
const chunkCache = new Map<string, CollectionChunk>();
const chunkPromiseCache = new Map<string, Promise<CollectionChunk>>();
let globalSearchIndexCache: GlobalSearchIndex | null = null;
let globalSearchIndexPromise: Promise<GlobalSearchIndex> | null = null;

interface LoadOptions {
  signal?: AbortSignal;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`加载资源失败: ${response.status}`);
  }

  return (await response.json()) as T;
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
    return cached;
  }

  const pending = manifestPromiseCache.get(prefix);
  if (pending) {
    return pending;
  }

  const promise = fetchJson<CollectionManifest>(
    `/iconify-data/collections/${prefix}/manifest.json`,
    options?.signal,
  )
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
  return promise;
}

export async function loadCollectionChunk(
  prefix: string,
  chunkId: number,
  options?: LoadOptions & { manifest?: CollectionManifest },
): Promise<CollectionChunk> {
  const chunkKey = `${prefix}:${chunkId}`;
  const cached = chunkCache.get(chunkKey);
  if (cached) {
    return cached;
  }

  const pending = chunkPromiseCache.get(chunkKey);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    const manifest = options?.manifest ?? (await loadCollectionManifest(prefix, options));
    const chunkMeta = manifest.chunks.find((chunk) => chunk.id === chunkId);

    if (!chunkMeta) {
      throw new Error(`未找到图标分片: ${prefix}#${chunkId}`);
    }

    const chunk = await fetchJson<CollectionChunk>(
      `/iconify-data/collections/${prefix}/${chunkMeta.file}`,
      options?.signal,
    );

    chunkPromiseCache.delete(chunkKey);
    chunkCache.set(chunkKey, chunk);
    return chunk;
  })().catch((error: unknown) => {
    chunkPromiseCache.delete(chunkKey);
    throw error;
  });

  chunkPromiseCache.set(chunkKey, promise);
  return promise;
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
    return globalSearchIndexCache;
  }

  if (globalSearchIndexPromise) {
    return globalSearchIndexPromise;
  }

  const promise = (async () => {
    const manifest = await fetchJson<GlobalSearchIndexManifest>(
      "/iconify-data/search/manifest.json",
      options?.signal,
    );
    assertNotAborted(options?.signal);

    const entries = await fetchJson<GlobalSearchIndexEntries>(
      `/iconify-data/search/${manifest.entriesFile}`,
      options?.signal,
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
  return promise;
}

export function searchGlobalSearchIndex(
  index: GlobalSearchIndex,
  query: string,
  limit = Number.POSITIVE_INFINITY,
): GlobalSearchHit[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || limit <= 0) {
    return [];
  }

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

    if (!index.names[indexOffset].toLowerCase().includes(normalizedQuery)) {
      continue;
    }

    hits.push({
      prefix: index.prefixes[currentRun[2]],
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
  limit = Number.POSITIVE_INFINITY,
  options?: LoadOptions,
): Promise<GlobalSearchHit[]> {
  if (!query.trim() || limit <= 0) {
    return [];
  }

  const index = await loadGlobalSearchIndex(options);
  return searchGlobalSearchIndex(index, query, limit);
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
