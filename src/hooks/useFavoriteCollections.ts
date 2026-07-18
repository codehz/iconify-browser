import { useCallback, useMemo } from "react";
import { useLocalStorage } from "foxact/use-local-storage";

const STORAGE_KEY = "iconify-favorite-collections";
const EMPTY_FAVORITES: string[] = [];

export function useFavoriteCollections() {
  const [favorites, setFavorites] = useLocalStorage<string[]>(STORAGE_KEY, []);
  const favoriteList = favorites ?? EMPTY_FAVORITES;
  const favoriteSet = useMemo(() => new Set(favoriteList), [favoriteList]);

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

  const isFavorite = useCallback((prefix: string) => favoriteSet.has(prefix), [favoriteSet]);

  return { favorites: favoriteList, favoriteSet, toggleFavorite, isFavorite };
}
