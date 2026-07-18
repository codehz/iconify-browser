import { useEffect, useMemo, useState } from "react";
import { DEFAULT_GLOBAL_SEARCH_LIMIT, isAbortError, searchIcons } from "../data/iconifyLoader";
import type { GlobalSearchHit } from "../types";
import { useDebouncedValue } from "foxact/use-debounced-value";

const DEBOUNCE_MS = 300;

export interface UseGlobalIconSearchOptions {
  prefixes?: Set<string>;
  limit?: number;
}

export function useGlobalIconSearch(query: string, options?: UseGlobalIconSearchOptions) {
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const limit = options?.limit ?? DEFAULT_GLOBAL_SEARCH_LIMIT;
  const prefixes = options?.prefixes;
  const prefixKey = useMemo(() => {
    if (!prefixes || prefixes.size === 0) {
      return "";
    }

    return Array.from(prefixes).sort().join("\0");
  }, [prefixes]);

  useEffect(() => {
    const controller = new AbortController();

    if (!debouncedQuery.trim()) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const prefixFilter = prefixKey.length > 0 ? new Set(prefixKey.split("\0")) : undefined;

    searchIcons(debouncedQuery, limit, {
      signal: controller.signal,
      prefixes: prefixFilter,
    })
      .then((nextHits) => {
        setHits(nextHits);
      })
      .catch((err) => {
        if (isAbortError(err)) {
          return;
        }

        setError(err instanceof Error ? err.message : "搜索图标失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, limit, prefixKey]);

  return {
    hits,
    loading,
    error,
    isDebouncing: query !== debouncedQuery,
    limit,
    isTruncated: hits.length >= limit && hits.length > 0,
  };
}
