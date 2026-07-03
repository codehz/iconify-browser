import { useEffect, useState } from "react";
import type { CollectionItem } from "../types";

interface CollectionRaw {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
  name: string;
  total: number;
  author?: { name: string; url: string };
  license?: { title: string; url: string };
  category?: string;
}

export function useCollections() {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/iconify-data/collections.json", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`加载图标包列表失败: ${response.status}`);
        }

        return (await response.json()) as Record<string, CollectionRaw>;
      })
      .then((raw) => {
        const list = Object.entries(raw)
          .map(([prefix, info]) => ({
            prefix,
            name: info.name,
            total: info.total,
            authorName: info.author?.name ?? "",
            licenseTitle: info.license?.title ?? "",
            category: info.category,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCollections(list);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(err instanceof Error ? err.message : "加载失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  return { collections, loading, error };
}
