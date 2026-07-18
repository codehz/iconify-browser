import { useEffect } from "react";
import { ensureSearchHitChunk, useSearchHitChunk } from "./useSearchHitChunks";

/**
 * Load a single search-hit chunk for DetailPanel, sharing the same cache/store
 * used by GlobalSearchView cards so opening detail does not refetch.
 */
export function useSearchHitCollection(prefix: string | null, chunkId: number | null) {
  const enabled = Boolean(prefix) && chunkId !== null;
  const safePrefix = prefix ?? "";
  const safeChunkId = chunkId ?? -1;

  useEffect(() => {
    if (!enabled || !prefix || chunkId === null) {
      return;
    }

    ensureSearchHitChunk(prefix, chunkId);
  }, [chunkId, enabled, prefix]);

  const state = useSearchHitChunk(safePrefix, safeChunkId);

  if (!enabled) {
    return { data: null, loading: false, error: null };
  }

  return {
    data: state.data,
    loading: state.loading || (!state.data && !state.error),
    error: state.error,
  };
}
