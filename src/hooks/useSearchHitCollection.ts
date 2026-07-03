import { useEffect, useState } from "react";
import type { IconifyJSON } from "@iconify/types";
import { isAbortError, loadIconBySearchHit } from "../data/iconifyLoader";

export function useSearchHitCollection(prefix: string | null, chunkId: number | null) {
  const [data, setData] = useState<IconifyJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!prefix || chunkId === null) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setData(null);
    setLoading(true);
    setError(null);

    loadIconBySearchHit(prefix, chunkId, { signal: controller.signal })
      .then((collection) => {
        setData(collection);
      })
      .catch((err) => {
        if (isAbortError(err)) {
          return;
        }

        setError(err instanceof Error ? err.message : "加载图标失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [chunkId, prefix]);

  return { data, loading, error };
}
