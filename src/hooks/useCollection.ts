import { useEffect, useState } from "react";
import type { IconifyJSON } from "@iconify/types";
import { isAbortError, loadCollection } from "../data/iconifyLoader";

export function useCollection(prefix: string | null) {
  const [data, setData] = useState<IconifyJSON | null>(null);
  const [dataPrefix, setDataPrefix] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!prefix) {
      setData(null);
      setDataPrefix(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Keep previous collection mounted while the next one loads (D1).
    setLoading(true);
    setError(null);

    loadCollection(prefix, { signal: controller.signal })
      .then((collection) => {
        setData(collection);
        setDataPrefix(prefix);
      })
      .catch((err) => {
        if (isAbortError(err)) {
          return;
        }

        setError(err instanceof Error ? err.message : "加载图标包失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [prefix]);

  const isRefreshing = Boolean(loading && data && dataPrefix !== prefix);

  return { data, dataPrefix, loading, error, isRefreshing };
}
