import { useEffect, useState } from "react";
import { isAbortError, searchIcons } from "../data/iconifyLoader";
import type { GlobalSearchHit } from "../types";

export function useGlobalIconSearch(query: string, limit = 100) {
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!query.trim() || limit <= 0) {
      setHits([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    searchIcons(query, limit, { signal: controller.signal })
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
  }, [limit, query]);

  return { hits, loading, error };
}
