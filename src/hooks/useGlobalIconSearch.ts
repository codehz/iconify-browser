import { useEffect, useState } from "react";
import { isAbortError, searchIcons } from "../data/iconifyLoader";
import type { GlobalSearchHit } from "../types";
import { useDebouncedValue } from "foxact/use-debounced-value";

const DEBOUNCE_MS = 300;

export function useGlobalIconSearch(query: string) {
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

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

    searchIcons(debouncedQuery, undefined, { signal: controller.signal })
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
  }, [debouncedQuery]);

  return { hits, loading, error, isDebouncing: query !== debouncedQuery };
}
