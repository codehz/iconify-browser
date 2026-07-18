import { useEffect, useMemo, useState } from "react";
import { isAbortError } from "../data/iconifyLoader";
import { searchIconsInWorker, warmGlobalSearchWorker } from "../data/globalSearchClient";
import type { GlobalSearchHit } from "../types";
import { useDebouncedValue } from "foxact/use-debounced-value";

const DEBOUNCE_MS = 300;

export interface UseGlobalIconSearchOptions {
  prefixes?: Set<string>;
}

export function useGlobalIconSearch(query: string, options?: UseGlobalIconSearchOptions) {
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const prefixes = options?.prefixes;
  const prefixKey = useMemo(() => {
    if (!prefixes || prefixes.size === 0) {
      return "";
    }

    return Array.from(prefixes).sort().join("\0");
  }, [prefixes]);

  useEffect(() => {
    warmGlobalSearchWorker();
  }, []);

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

    searchIconsInWorker(debouncedQuery, {
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
  }, [debouncedQuery, prefixKey]);

  return {
    hits,
    loading,
    error,
    isDebouncing: query !== debouncedQuery,
  };
}
