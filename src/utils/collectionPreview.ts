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

export function getIconSuffixKey(
  name: string,
  suffixEntries: Array<[string, string]>,
): string | null {
  if (suffixEntries.length === 0) {
    return null;
  }

  const orderedSuffixes = suffixEntries
    .map(([suffix]) => suffix)
    .filter((suffix) => suffix.length > 0)
    .sort((left, right) => right.length - left.length);
  const matchedSuffix = getMatchingSuffix(name, orderedSuffixes);

  if (matchedSuffix) {
    return matchedSuffix;
  }

  return suffixEntries.some(([suffix]) => suffix === "") ? "" : null;
}

export function countIconsBySuffix(
  names: string[],
  suffixEntries: Array<[string, string]>,
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const [suffix] of suffixEntries) {
    counts.set(suffix, 0);
  }

  for (const name of names) {
    const suffix = getIconSuffixKey(name, suffixEntries);
    if (suffix === null) {
      continue;
    }

    counts.set(suffix, (counts.get(suffix) ?? 0) + 1);
  }

  return counts;
}
