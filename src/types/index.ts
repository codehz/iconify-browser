import type { IconifyJSON } from "@iconify/types";

export interface CollectionItem {
  prefix: string;
  name: string;
  total: number;
  authorName: string;
  licenseTitle: string;
  category?: string;
}

export interface SelectedIconInfo {
  name: string;
  collectionPrefix: string;
  collectionName: string;
}

export interface CollectionChunk {
  icons: NonNullable<IconifyJSON["icons"]>;
  aliases?: NonNullable<IconifyJSON["aliases"]>;
}

export interface CollectionChunkMeta {
  id: number;
  file: string;
  iconCount: number;
  aliasCount: number;
}

export interface CollectionManifest {
  version: number;
  prefix: string;
  iconCount: number;
  aliasCount: number;
  base: Omit<IconifyJSON, "icons" | "aliases">;
  chunks: CollectionChunkMeta[];
}

export interface GlobalSearchIndexManifest {
  version: number;
  entryCount: number;
  prefixCount: number;
  normalization: "lowercase-substring";
  entriesFile: string;
}

export interface GlobalSearchIndexEntries {
  prefixes: string[];
  names: string[];
  prefixIds: number[];
  chunkIds: number[];
  aliasFlags: number[];
}

export interface GlobalSearchIndex extends GlobalSearchIndexManifest, GlobalSearchIndexEntries {}

export interface GlobalSearchHit {
  prefix: string;
  name: string;
  chunkId: number;
  isAlias: boolean;
}
