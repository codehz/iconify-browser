import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { IconifyJSON } from "@iconify/types";
import { isAbortError, loadIconBySearchHit } from "../data/iconifyLoader";

export interface SearchHitChunkKey {
  prefix: string;
  chunkId: number;
}

export interface SearchHitChunkState {
  data: IconifyJSON | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: SearchHitChunkState = {
  data: null,
  loading: false,
  error: null,
};

type Listener = () => void;

const chunkStateCache = new Map<string, SearchHitChunkState>();
const inflight = new Set<string>();
const listenersByKey = new Map<string, Set<Listener>>();

function toChunkKey(prefix: string, chunkId: number) {
  return `${prefix}:${chunkId}`;
}

function getChunkState(key: string): SearchHitChunkState {
  return chunkStateCache.get(key) ?? EMPTY_STATE;
}

function setChunkState(key: string, state: SearchHitChunkState) {
  chunkStateCache.set(key, state);
  emit(key);
}

function emit(key: string) {
  const listeners = listenersByKey.get(key);
  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(key: string, listener: Listener) {
  let listeners = listenersByKey.get(key);
  if (!listeners) {
    listeners = new Set();
    listenersByKey.set(key, listeners);
  }

  listeners.add(listener);
  return () => {
    listeners!.delete(listener);
    if (listeners!.size === 0) {
      listenersByKey.delete(key);
    }
  };
}

function ensureChunkLoaded(prefix: string, chunkId: number) {
  const key = toChunkKey(prefix, chunkId);
  const current = chunkStateCache.get(key);

  if (current?.data || current?.loading || inflight.has(key)) {
    return;
  }

  inflight.add(key);
  setChunkState(key, { data: null, loading: true, error: null });

  void loadIconBySearchHit(prefix, chunkId)
    .then((data) => {
      setChunkState(key, { data, loading: false, error: null });
    })
    .catch((err) => {
      if (isAbortError(err)) {
        chunkStateCache.delete(key);
        emit(key);
        return;
      }

      setChunkState(key, {
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "加载图标失败",
      });
    })
    .finally(() => {
      inflight.delete(key);
    });
}

/**
 * Batch-request unique (prefix, chunkId) pairs for the current visible window.
 * Does not subscribe to state; pair with `useSearchHitChunk` for per-card updates.
 */
export function useEnsureSearchHitChunks(keys: SearchHitChunkKey[]) {
  const requestKey = useMemo(() => {
    const ids = new Set<string>();
    for (const key of keys) {
      ids.add(toChunkKey(key.prefix, key.chunkId));
    }
    return Array.from(ids).sort().join("|");
  }, [keys]);

  useEffect(() => {
    if (!requestKey) {
      return;
    }

    for (const id of requestKey.split("|")) {
      const separator = id.lastIndexOf(":");
      ensureChunkLoaded(id.slice(0, separator), Number(id.slice(separator + 1)));
    }
  }, [requestKey]);
}

/** Subscribe to a single search-hit chunk. Only re-renders when that key changes. */
export function useSearchHitChunk(prefix: string, chunkId: number): SearchHitChunkState {
  const key = toChunkKey(prefix, chunkId);

  return useSyncExternalStore(
    (onStoreChange) => subscribe(key, onStoreChange),
    () => getChunkState(key),
    () => getChunkState(key),
  );
}

/** Read a chunk from the shared cache without subscribing. */
export function getSearchHitChunkState(prefix: string, chunkId: number): SearchHitChunkState {
  return getChunkState(toChunkKey(prefix, chunkId));
}

/** Ensure a chunk is loading/loaded and return the current snapshot. */
export function ensureSearchHitChunk(prefix: string, chunkId: number): SearchHitChunkState {
  ensureChunkLoaded(prefix, chunkId);
  return getChunkState(toChunkKey(prefix, chunkId));
}

/** Test / hot-reload helper. */
export function resetSearchHitChunkStore() {
  chunkStateCache.clear();
  inflight.clear();
  listenersByKey.clear();
}
