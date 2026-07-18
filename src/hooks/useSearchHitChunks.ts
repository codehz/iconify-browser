import { useEffect, useMemo, useRef, useState } from "react";
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

function toChunkKey(prefix: string, chunkId: number) {
  return `${prefix}:${chunkId}`;
}

/**
 * Batch-load unique (prefix, chunkId) pairs for the current visible window.
 * Loads are not aborted on range change so scrolling does not thrash network.
 */
export function useSearchHitChunks(keys: SearchHitChunkKey[]) {
  const cacheRef = useRef(new Map<string, SearchHitChunkState>());
  const inflightRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const requestKey = useMemo(() => {
    const ids = new Set<string>();
    for (const key of keys) {
      ids.add(toChunkKey(key.prefix, key.chunkId));
    }
    return Array.from(ids).sort().join("|");
  }, [keys]);

  const uniqueKeys = useMemo(() => {
    if (!requestKey) {
      return [] as SearchHitChunkKey[];
    }

    return requestKey.split("|").map((id) => {
      const separator = id.lastIndexOf(":");
      return {
        prefix: id.slice(0, separator),
        chunkId: Number(id.slice(separator + 1)),
      };
    });
  }, [requestKey]);

  useEffect(() => {
    if (uniqueKeys.length === 0) {
      return;
    }

    const cache = cacheRef.current;
    const inflight = inflightRef.current;
    const pending = uniqueKeys.filter((key) => {
      const id = toChunkKey(key.prefix, key.chunkId);
      if (cache.get(id)?.data) {
        return false;
      }
      if (inflight.has(id)) {
        return false;
      }
      return true;
    });

    if (pending.length === 0) {
      return;
    }

    for (const key of pending) {
      const id = toChunkKey(key.prefix, key.chunkId);
      inflight.add(id);
      cache.set(id, { data: null, loading: true, error: null });
    }
    if (mountedRef.current) {
      setVersion((value) => value + 1);
    }

    for (const key of pending) {
      const id = toChunkKey(key.prefix, key.chunkId);
      void loadIconBySearchHit(key.prefix, key.chunkId)
        .then((data) => {
          cache.set(id, { data, loading: false, error: null });
          if (mountedRef.current) {
            setVersion((value) => value + 1);
          }
        })
        .catch((err) => {
          if (isAbortError(err)) {
            cache.delete(id);
            return;
          }

          cache.set(id, {
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "加载图标失败",
          });
          if (mountedRef.current) {
            setVersion((value) => value + 1);
          }
        })
        .finally(() => {
          inflight.delete(id);
        });
    }
  }, [requestKey, uniqueKeys]);

  return useMemo(
    () => ({
      get(prefix: string, chunkId: number): SearchHitChunkState {
        return cacheRef.current.get(toChunkKey(prefix, chunkId)) ?? EMPTY_STATE;
      },
    }),
    // version forces consumers to re-read after cache updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
}
