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
    import("@iconify/json/collections.json")
      .then((mod) => {
        const raw = mod.default as unknown as Record<string, CollectionRaw>;
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
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "加载失败");
        setLoading(false);
      });
  }, []);

  return { collections, loading, error };
}
