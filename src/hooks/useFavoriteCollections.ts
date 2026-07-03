import { useCallback } from "react";
import { useLocalStorage } from "foxact/use-local-storage";

const STORAGE_KEY = "iconify-favorite-collections";

export function useFavoriteCollections() {
  const [favorites, setFavorites] = useLocalStorage<string[]>(STORAGE_KEY, []);

  const toggleFavorite = useCallback(
    (prefix: string) => {
      setFavorites((prev) => {
        const current = prev ?? [];
        return current.includes(prefix)
          ? current.filter((p) => p !== prefix)
          : [...current, prefix];
      });
    },
    [setFavorites],
  );

  const isFavorite = useCallback(
    (prefix: string) => (favorites ?? []).includes(prefix),
    [favorites],
  );

  return { favorites: favorites ?? [], toggleFavorite, isFavorite };
}
