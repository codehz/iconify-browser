import type {
  GlobalSearchHit,
  GlobalSearchIndex,
  GlobalSearchIndexEntries,
  GlobalSearchIndexManifest,
  GlobalSearchRun,
  IconifyDataIndex,
} from "../types";

const DATA_INDEX_URL = "/iconify-data/index.json";

let iconifyDataIndexCache: IconifyDataIndex | null = null;
let iconifyDataIndexPromise: Promise<IconifyDataIndex> | null = null;
let globalSearchIndexCache: GlobalSearchIndex | null = null;
let globalSearchIndexPromise: Promise<GlobalSearchIndex> | null = null;
const loweredNamesCache = new WeakMap<GlobalSearchIndex, string[]>();

export interface GlobalSearchLoadOptions {
  signal?: AbortSignal;
}

export interface GlobalSearchQueryOptions extends GlobalSearchLoadOptions {
  prefixes?: readonly string[] | Set<string>;
  /** Optional soft cap; omit for unlimited results. */
  limit?: number;
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

function toPrefixSet(prefixes?: readonly string[] | Set<string>): Set<string> | undefined {
  if (!prefixes) {
    return undefined;
  }

  if (prefixes instanceof Set) {
    return prefixes.size > 0 ? prefixes : undefined;
  }

  return prefixes.length > 0 ? new Set(prefixes) : undefined;
}

export function isValidGlobalSearchRuns(
  nameCount: number,
  runs: GlobalSearchRun[],
  prefixCount: number,
): boolean {
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

async function loadIconifyDataIndex(options?: GlobalSearchLoadOptions): Promise<IconifyDataIndex> {
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

export async function loadGlobalSearchIndex(
  options?: GlobalSearchLoadOptions,
): Promise<GlobalSearchIndex> {
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
  prefixes?: readonly string[] | Set<string>,
): GlobalSearchHit[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || limit <= 0) {
    return [];
  }

  const prefixFilter = toPrefixSet(prefixes);
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

    if (prefixFilter && !prefixFilter.has(prefix)) {
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
  options?: GlobalSearchQueryOptions,
): Promise<GlobalSearchHit[]> {
  if (!query.trim()) {
    return [];
  }

  const index = await loadGlobalSearchIndex(options);
  assertNotAborted(options?.signal);
  return searchGlobalSearchIndex(index, query, options?.limit, options?.prefixes);
}

export function resetGlobalSearchCaches() {
  iconifyDataIndexCache = null;
  iconifyDataIndexPromise = null;
  globalSearchIndexCache = null;
  globalSearchIndexPromise = null;
}
