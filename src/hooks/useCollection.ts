import { useEffect, useState } from "react";
import type { IconifyJSON } from "@iconify/types";

const collectionUrls = import.meta.glob("/node_modules/@iconify/json/json/*.json", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

export function useCollection(prefix: string | null) {
  const [data, setData] = useState<IconifyJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    if (!prefix) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const modulePath = `/node_modules/@iconify/json/json/${prefix}.json`;
    const collectionUrl = collectionUrls[modulePath];

    if (!collectionUrl) {
      setData(null);
      setLoading(false);
      setError(`未找到图标包: ${prefix}`);
      return;
    }

    setData(null);
    setLoading(true);
    setError(null);

    fetch(collectionUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`加载图标包失败: ${response.status}`);
        }

        return (await response.json()) as IconifyJSON;
      })
      .then((json) => {
        setData(json);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
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

  return { data, loading, error };
}
