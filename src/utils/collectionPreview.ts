import type { IconifyJSON } from "@iconify/types";

export function getCollectionSuffixEntries(
  collection: Pick<IconifyJSON, "suffixes">,
): Array<[string, string]> {
  return Object.entries(collection.suffixes ?? {}).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

function getMatchingSuffix(name: string, suffixes: string[]) {
  for (const suffix of suffixes) {
    if (name.endsWith(`-${suffix}`)) {
      return suffix;
    }
  }

  return null;
}

export type SuffixMatcher = (name: string) => string | null;

/** Precompute ordered suffixes once; avoids re-sorting per icon name. */
export function createSuffixMatcher(suffixEntries: Array<[string, string]>): SuffixMatcher {
  if (suffixEntries.length === 0) {
    return () => null;
  }

  const orderedSuffixes = suffixEntries
    .map(([suffix]) => suffix)
    .filter((suffix) => suffix.length > 0)
    .sort((left, right) => right.length - left.length);
  const hasDefault = suffixEntries.some(([suffix]) => suffix === "");

  return (name: string) => {
    const matchedSuffix = getMatchingSuffix(name, orderedSuffixes);
    if (matchedSuffix) {
      return matchedSuffix;
    }

    return hasDefault ? "" : null;
  };
}

export function getIconSuffixKey(
  name: string,
  suffixEntries: Array<[string, string]>,
): string | null {
  return createSuffixMatcher(suffixEntries)(name);
}

export function countIconsBySuffix(
  names: string[],
  suffixEntries: Array<[string, string]>,
  matchSuffix: SuffixMatcher = createSuffixMatcher(suffixEntries),
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const [suffix] of suffixEntries) {
    counts.set(suffix, 0);
  }

  for (const name of names) {
    const suffix = matchSuffix(name);
    if (suffix === null) {
      continue;
    }

    counts.set(suffix, (counts.get(suffix) ?? 0) + 1);
  }

  return counts;
}

export interface CategoryFilter {
  category: string;
  names: Set<string>;
}

/** Reverse index: icon name → categories it belongs to. Built once per collection. */
export function buildNameToCategories(
  categoryFilters: Array<CategoryFilter>,
): Map<string, string[]> {
  const nameToCategories = new Map<string, string[]>();

  for (const filter of categoryFilters) {
    for (const name of filter.names) {
      const existing = nameToCategories.get(name);
      if (existing) {
        existing.push(filter.category);
      } else {
        nameToCategories.set(name, [filter.category]);
      }
    }
  }

  return nameToCategories;
}

/** Single pass over names using reverse index — O(names × categories-per-name). */
export function countIconsByCategory(
  names: string[],
  categoryFilters: Array<CategoryFilter>,
  nameToCategories: Map<string, string[]> = buildNameToCategories(categoryFilters),
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const filter of categoryFilters) {
    counts.set(filter.category, 0);
  }

  for (const name of names) {
    const categories = nameToCategories.get(name);
    if (!categories) {
      continue;
    }

    for (const category of categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  return counts;
}

export function getCollectionCategoryEntries(
  collection: Pick<IconifyJSON, "categories">,
): Array<[string, string[]]> {
  return Object.entries(collection.categories ?? {}).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((name) => typeof name === "string"),
  );
}

function isAliasInCategory(
  aliasName: string,
  aliases: NonNullable<IconifyJSON["aliases"]>,
  categoryNames: Set<string>,
  cache: Map<string, boolean>,
  seen = new Set<string>(),
): boolean {
  const cached = cache.get(aliasName);
  if (cached !== undefined) {
    return cached;
  }

  if (seen.has(aliasName)) {
    cache.set(aliasName, false);
    return false;
  }

  const alias = aliases[aliasName];
  if (!alias) {
    cache.set(aliasName, false);
    return false;
  }

  if (categoryNames.has(alias.parent)) {
    cache.set(aliasName, true);
    return true;
  }

  seen.add(aliasName);
  const result = isAliasInCategory(alias.parent, aliases, categoryNames, cache, seen);
  cache.set(aliasName, result);
  return result;
}

export function buildCategoryNameSet(
  iconNames: string[],
  aliases?: IconifyJSON["aliases"],
): Set<string> {
  const categoryNames = new Set(iconNames);

  if (!aliases) {
    return categoryNames;
  }

  const cache = new Map<string, boolean>();
  for (const aliasName of Object.keys(aliases)) {
    if (isAliasInCategory(aliasName, aliases, categoryNames, cache)) {
      categoryNames.add(aliasName);
    }
  }

  return categoryNames;
}
