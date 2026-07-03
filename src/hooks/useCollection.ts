import { useEffect, useState } from "react";
import type { IconifyJSON } from "@iconify/types";

interface CollectionChunk {
  icons: NonNullable<IconifyJSON["icons"]>;
  aliases?: NonNullable<IconifyJSON["aliases"]>;
}

interface CollectionManifest {
  version: number;
  prefix: string;
  iconCount: number;
  aliasCount: number;
  base: Omit<IconifyJSON, "icons" | "aliases">;
  chunks: string[];
}

function mergeCollection(manifest: CollectionManifest, chunks: CollectionChunk[]): IconifyJSON {
  const icons: NonNullable<IconifyJSON["icons"]> = {};
  const aliases: NonNullable<IconifyJSON["aliases"]> = {};

  for (const chunk of chunks) {
    Object.assign(icons, chunk.icons);

    if (chunk.aliases) {
      Object.assign(aliases, chunk.aliases);
    }
  }

  const collection: IconifyJSON = {
    ...manifest.base,
    prefix: manifest.prefix,
    icons,
  };

  if (Object.keys(aliases).length > 0) {
    collection.aliases = aliases;
  }

  return collection;
}

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

    setData(null);
    setLoading(true);
    setError(null);

    fetch(`/iconify-data/collections/${prefix}/manifest.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`加载图标包失败: ${response.status}`);
        }

        return (await response.json()) as CollectionManifest;
      })
      .then(async (manifest) => {
        const chunks = await Promise.all(
          manifest.chunks.map(async (chunkFile) => {
            const response = await fetch(`/iconify-data/collections/${prefix}/${chunkFile}`, {
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(`加载图标分片失败: ${response.status}`);
            }

            return (await response.json()) as CollectionChunk;
          }),
        );

        return mergeCollection(manifest, chunks);
      })
      .then((collection) => {
        setData(collection);
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
