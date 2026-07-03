import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants as zlibConstants, gzipSync } from "node:zlib";

const OUTPUT_DIR = path.join("public", "iconify-data");
const SCHEMA_VERSION = 4;
// Smaller chunks improve search-hit follow-up fetches under HTTP/2 without exploding request counts.
const CHUNK_TARGET_BYTES = 2 * 1024 * 1024;
const DATA_INDEX_FILE = "index.json";
const SEARCH_NORMALIZATION = "lowercase-substring";
const STATS_CHUNK_LIMIT = 5;
const CONTENT_HASH_LENGTH = 12;

interface IconifyAlias {
  parent: string;
  [key: string]: unknown;
}

interface IconifyCollectionSource {
  prefix: string;
  icons: Record<string, unknown>;
  aliases?: Record<string, IconifyAlias>;
  [key: string]: unknown;
}

interface GeneratedChunk {
  icons: Record<string, unknown>;
  aliases?: Record<string, IconifyAlias>;
}

interface GeneratedChunkMeta {
  id: number;
  file: string;
  hash: string;
  iconCount: number;
  aliasCount: number;
}

interface GeneratedCollectionManifest {
  version: number;
  prefix: string;
  iconCount: number;
  aliasCount: number;
  base: Record<string, unknown>;
  chunks: GeneratedChunkMeta[];
}

interface SearchableEntry {
  name: string;
  chunkId: number;
  isAlias: boolean;
}

interface ShardedCollection {
  manifest: GeneratedCollectionManifest;
  chunks: GeneratedChunk[];
  searchEntries: SearchableEntry[];
}

interface GlobalSearchManifest {
  version: number;
  entryCount: number;
  prefixCount: number;
  normalization: typeof SEARCH_NORMALIZATION;
  entriesFile: string;
  entriesHash: string;
}

interface GlobalSearchEntries {
  prefixes: string[];
  names: string[];
  runs: Array<[start: number, length: number, prefixId: number, chunkId: number, aliasFlag: 0 | 1]>;
}

interface GeneratedGlobalSearchIndex {
  manifest: GlobalSearchManifest;
  entries: GlobalSearchEntries;
}

interface GeneratedAssetRef {
  path: string;
  hash: string;
}

interface GeneratedCollectionAssetIndex {
  manifest: GeneratedAssetRef;
  chunks: GeneratedAssetRef[];
}

interface GeneratedDataIndex {
  version: number;
  collectionCount: number;
  collections: GeneratedAssetRef;
  search: {
    manifest: GeneratedAssetRef;
  };
  collectionManifests: Record<string, GeneratedAssetRef>;
  assets: GeneratedAssetRef[];
}

interface GenerationMeta {
  schemaVersion: number;
  packageVersion: string;
  chunkTargetBytes: number;
  collectionCount: number;
}

interface ChunkingResult {
  iconChunks: GeneratedChunk[];
  iconChunkMap: Map<string, number>;
}

interface SizeStat {
  label: string;
  rawBytes: number;
}

function getBaseCollectionData(collection: IconifyCollectionSource): Record<string, unknown> {
  const base: Partial<IconifyCollectionSource> = { ...collection };
  delete base.icons;
  delete base.aliases;
  return base;
}

function getEntrySize(name: string, value: unknown) {
  return Buffer.byteLength(JSON.stringify({ [name]: value }));
}

function createContentHash(raw: Buffer | string) {
  const buffer = typeof raw === "string" ? Buffer.from(raw) : raw;
  return createHash("sha256").update(buffer).digest("hex").slice(0, CONTENT_HASH_LENGTH);
}

function createHashedJsonFileName(baseName: string, rawJson: string) {
  const hash = createContentHash(rawJson);
  return {
    file: `${baseName}.${hash}.json`,
    hash,
  };
}

function createAssetRef(assetPath: string, hash: string): GeneratedAssetRef {
  return {
    path: `/iconify-data/${assetPath.replaceAll(path.sep, "/")}`,
    hash,
  };
}

function createIconChunks(
  icons: Record<string, unknown>,
  chunkTargetBytes = CHUNK_TARGET_BYTES,
): ChunkingResult {
  const iconChunks: GeneratedChunk[] = [];
  const iconChunkMap = new Map<string, number>();
  let currentIcons: Record<string, unknown> = {};
  let currentSize = 2;

  const flush = () => {
    if (Object.keys(currentIcons).length === 0) {
      return;
    }

    iconChunks.push({ icons: currentIcons });
    currentIcons = {};
    currentSize = 2;
  };

  for (const [name, data] of Object.entries(icons)) {
    const entrySize = getEntrySize(name, data);

    if (currentSize > 2 && currentSize + entrySize > chunkTargetBytes) {
      flush();
    }

    currentIcons[name] = data;
    iconChunkMap.set(name, iconChunks.length);
    currentSize += entrySize;
  }

  flush();

  if (iconChunks.length === 0) {
    iconChunks.push({ icons: {} });
  }

  return { iconChunks, iconChunkMap };
}

function assignAliasesToChunks(
  aliases: Record<string, IconifyAlias> | undefined,
  iconChunks: GeneratedChunk[],
  iconChunkMap: Map<string, number>,
) {
  const aliasChunkMap = new Map<string, number>();

  if (!aliases) {
    return aliasChunkMap;
  }

  const resolveChunkIndex = (aliasName: string, seen = new Set<string>()): number => {
    if (aliasChunkMap.has(aliasName)) {
      return aliasChunkMap.get(aliasName) ?? 0;
    }

    if (iconChunkMap.has(aliasName)) {
      return iconChunkMap.get(aliasName) ?? 0;
    }

    if (seen.has(aliasName)) {
      return 0;
    }

    const alias = aliases[aliasName];
    if (!alias) {
      return 0;
    }

    seen.add(aliasName);
    const chunkIndex = resolveChunkIndex(alias.parent, seen);
    aliasChunkMap.set(aliasName, chunkIndex);
    return chunkIndex;
  };

  for (const [name, alias] of Object.entries(aliases)) {
    const chunkIndex = resolveChunkIndex(name);
    const chunk = iconChunks[chunkIndex] ?? iconChunks[0];

    if (!chunk.aliases) {
      chunk.aliases = {};
    }

    chunk.aliases[name] = alias;
  }

  return aliasChunkMap;
}

function buildChunkMeta(chunk: GeneratedChunk, id: number): GeneratedChunkMeta {
  const chunkJson = JSON.stringify(chunk);
  const { file, hash } = createHashedJsonFileName(`chunk-${id}`, chunkJson);
  return {
    id,
    file,
    hash,
    iconCount: Object.keys(chunk.icons).length,
    aliasCount: Object.keys(chunk.aliases ?? {}).length,
  };
}

function buildSearchEntries(chunks: GeneratedChunk[]) {
  const searchEntries: SearchableEntry[] = [];

  for (const [chunkId, chunk] of chunks.entries()) {
    for (const name of Object.keys(chunk.icons).sort()) {
      searchEntries.push({
        name,
        chunkId,
        isAlias: false,
      });
    }

    for (const name of Object.keys(chunk.aliases ?? {}).sort()) {
      searchEntries.push({
        name,
        chunkId,
        isAlias: true,
      });
    }
  }

  return searchEntries;
}

export function shardCollection(
  collection: IconifyCollectionSource,
  chunkTargetBytes = CHUNK_TARGET_BYTES,
): ShardedCollection {
  const { iconChunks, iconChunkMap } = createIconChunks(collection.icons, chunkTargetBytes);
  assignAliasesToChunks(collection.aliases, iconChunks, iconChunkMap);

  const manifest: GeneratedCollectionManifest = {
    version: SCHEMA_VERSION,
    prefix: collection.prefix,
    iconCount: Object.keys(collection.icons).length,
    aliasCount: Object.keys(collection.aliases ?? {}).length,
    base: getBaseCollectionData(collection),
    chunks: iconChunks.map((chunk, index) => buildChunkMeta(chunk, index)),
  };

  return {
    manifest,
    chunks: iconChunks,
    searchEntries: buildSearchEntries(iconChunks),
  };
}

export function buildGlobalSearchIndex(
  collections: Array<Pick<ShardedCollection, "manifest" | "searchEntries">>,
): GeneratedGlobalSearchIndex {
  const sortedCollections = [...collections].sort((left, right) =>
    left.manifest.prefix.localeCompare(right.manifest.prefix),
  );
  const prefixes = sortedCollections.map((collection) => collection.manifest.prefix);
  const prefixIds = new Map(prefixes.map((prefix, index) => [prefix, index]));
  const names: string[] = [];
  const runs: GlobalSearchEntries["runs"] = [];

  for (const collection of sortedCollections) {
    const prefixId = prefixIds.get(collection.manifest.prefix);
    if (prefixId === undefined) {
      continue;
    }

    let currentRun: GlobalSearchEntries["runs"][number] | null = null;
    for (const entry of collection.searchEntries) {
      const nextIndex = names.length;
      names.push(entry.name);

      const aliasFlag = entry.isAlias ? 1 : 0;
      if (
        currentRun &&
        currentRun[2] === prefixId &&
        currentRun[3] === entry.chunkId &&
        currentRun[4] === aliasFlag &&
        currentRun[0] + currentRun[1] === nextIndex
      ) {
        currentRun[1] += 1;
        continue;
      }

      currentRun = [nextIndex, 1, prefixId, entry.chunkId, aliasFlag];
      runs.push(currentRun);
    }
  }

  return {
    manifest: {
      version: SCHEMA_VERSION,
      entryCount: names.length,
      prefixCount: prefixes.length,
      normalization: SEARCH_NORMALIZATION,
      entriesFile: createHashedJsonFileName("entries", JSON.stringify({ prefixes, names, runs }))
        .file,
      entriesHash: createContentHash(JSON.stringify({ prefixes, names, runs })),
    },
    entries: {
      prefixes,
      names,
      runs,
    },
  };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function shouldSkipGeneration(outputDir: string, nextMeta: GenerationMeta) {
  const metaPath = path.join(outputDir, "_meta.json");

  try {
    const currentMeta = await readJsonFile<GenerationMeta>(metaPath);
    return JSON.stringify(currentMeta) === JSON.stringify(nextMeta);
  } catch {
    return false;
  }
}

function createSizeStat(label: string, rawBytes: number): SizeStat {
  return { label, rawBytes };
}

function pickLargestStats<T extends SizeStat>(stats: T[], limit: number) {
  return [...stats].sort((left, right) => right.rawBytes - left.rawBytes).slice(0, limit);
}

function formatSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function measureCompressedSizes(raw: Buffer | string) {
  const buffer = typeof raw === "string" ? Buffer.from(raw) : raw;
  const gzipBytes = gzipSync(buffer, { level: 9 }).length;
  const brotliBytes = brotliCompressSync(buffer, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
    },
  }).length;

  return {
    rawBytes: buffer.length,
    gzipBytes,
    brotliBytes,
  };
}

function printGenerationStats(
  searchEntriesFile: string,
  searchEntriesJson: string,
  chunkStats: Array<SizeStat & { json: string }>,
) {
  const searchStats = measureCompressedSizes(searchEntriesJson);
  console.info(
    `[iconify-data] search/${searchEntriesFile}: raw=${formatSize(searchStats.rawBytes)} gzip=${formatSize(searchStats.gzipBytes)} brotli=${formatSize(searchStats.brotliBytes)}`,
  );

  for (const chunkStat of pickLargestStats(chunkStats, STATS_CHUNK_LIMIT)) {
    const compressed = measureCompressedSizes(chunkStat.json);
    console.info(
      `[iconify-data] ${chunkStat.label}: raw=${formatSize(compressed.rawBytes)} gzip=${formatSize(compressed.gzipBytes)} brotli=${formatSize(compressed.brotliBytes)}`,
    );
  }
}

export function buildGeneratedDataIndex(
  collectionsAsset: GeneratedAssetRef,
  searchManifestAsset: GeneratedAssetRef,
  collectionAssets: Record<string, GeneratedCollectionAssetIndex>,
  extraAssets: GeneratedAssetRef[],
): GeneratedDataIndex {
  const collectionManifests = Object.fromEntries(
    Object.entries(collectionAssets)
      .sort(([leftPrefix], [rightPrefix]) => leftPrefix.localeCompare(rightPrefix))
      .map(([prefix, assets]) => [prefix, assets.manifest]),
  );
  const assets = [
    collectionsAsset,
    searchManifestAsset,
    ...extraAssets,
    ...Object.values(collectionAssets)
      .flatMap((assets) => [assets.manifest, ...assets.chunks])
      .sort((left, right) => left.path.localeCompare(right.path)),
  ];

  return {
    version: SCHEMA_VERSION,
    collectionCount: Object.keys(collectionAssets).length,
    collections: collectionsAsset,
    search: {
      manifest: searchManifestAsset,
    },
    collectionManifests,
    assets: assets.sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export async function ensureIconifyData(rootDir: string) {
  const packagePath = path.join(rootDir, "node_modules", "@iconify", "json", "package.json");
  const collectionsPath = path.join(
    rootDir,
    "node_modules",
    "@iconify",
    "json",
    "collections.json",
  );
  const jsonDir = path.join(rootDir, "node_modules", "@iconify", "json", "json");
  const outputDir = path.join(rootDir, OUTPUT_DIR);

  const packageJson = await readJsonFile<{ version: string }>(packagePath);
  const collections = await readJsonFile<Record<string, unknown>>(collectionsPath);
  const collectionPrefixes = Object.keys(collections).sort();

  const nextMeta: GenerationMeta = {
    schemaVersion: SCHEMA_VERSION,
    packageVersion: packageJson.version,
    chunkTargetBytes: CHUNK_TARGET_BYTES,
    collectionCount: collectionPrefixes.length,
  };

  if (await shouldSkipGeneration(outputDir, nextMeta)) {
    return;
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, "collections"), { recursive: true });
  await mkdir(path.join(outputDir, "search"), { recursive: true });
  const collectionsJson = JSON.stringify(collections);
  const collectionsFileMeta = createHashedJsonFileName("collections", collectionsJson);
  const collectionsRelativePath = collectionsFileMeta.file;
  await writeFile(path.join(outputDir, collectionsRelativePath), collectionsJson);

  const shardedCollections: ShardedCollection[] = [];
  const chunkStats: Array<SizeStat & { json: string }> = [];
  const collectionAssets: Record<string, GeneratedCollectionAssetIndex> = {};

  for (const prefix of collectionPrefixes) {
    const sourcePath = path.join(jsonDir, `${prefix}.json`);
    const collection = await readJsonFile<IconifyCollectionSource>(sourcePath);
    const shardedCollection = shardCollection(collection);
    const collectionDir = path.join(outputDir, "collections", prefix);
    const collectionRelativeDir = path.join("collections", prefix);

    shardedCollections.push(shardedCollection);
    await mkdir(collectionDir, { recursive: true });

    const chunkAssets: GeneratedAssetRef[] = [];

    for (const [index, chunk] of shardedCollection.chunks.entries()) {
      const chunkJson = JSON.stringify(chunk);
      const chunkMeta = shardedCollection.manifest.chunks[index];

      await writeFile(path.join(collectionDir, chunkMeta.file), chunkJson);
      chunkAssets.push(
        createAssetRef(path.join(collectionRelativeDir, chunkMeta.file), chunkMeta.hash),
      );
      chunkStats.push({
        ...createSizeStat(`collections/${prefix}/${chunkMeta.file}`, Buffer.byteLength(chunkJson)),
        json: chunkJson,
      });
    }

    const manifestJson = JSON.stringify(shardedCollection.manifest);
    const manifestFileMeta = createHashedJsonFileName("manifest", manifestJson);
    await writeFile(path.join(collectionDir, manifestFileMeta.file), manifestJson);
    collectionAssets[prefix] = {
      manifest: createAssetRef(
        path.join(collectionRelativeDir, manifestFileMeta.file),
        manifestFileMeta.hash,
      ),
      chunks: chunkAssets,
    };
  }

  const globalSearchIndex = buildGlobalSearchIndex(shardedCollections);
  const searchEntriesJson = JSON.stringify(globalSearchIndex.entries);
  const searchEntriesFile = globalSearchIndex.manifest.entriesFile;
  const searchEntriesPath = path.join(outputDir, "search", searchEntriesFile);
  const searchManifestJson = JSON.stringify(globalSearchIndex.manifest);
  const searchManifestFileMeta = createHashedJsonFileName("manifest", searchManifestJson);
  const searchManifestPath = path.join(outputDir, "search", searchManifestFileMeta.file);
  const dataIndex = buildGeneratedDataIndex(
    createAssetRef(collectionsRelativePath, collectionsFileMeta.hash),
    createAssetRef(path.join("search", searchManifestFileMeta.file), searchManifestFileMeta.hash),
    collectionAssets,
    [
      createAssetRef(
        path.join("search", searchEntriesFile),
        globalSearchIndex.manifest.entriesHash,
      ),
    ],
  );

  await writeFile(searchManifestPath, searchManifestJson);
  await writeFile(searchEntriesPath, searchEntriesJson);
  await writeFile(path.join(outputDir, DATA_INDEX_FILE), JSON.stringify(dataIndex));
  await writeFile(path.join(outputDir, "_meta.json"), JSON.stringify(nextMeta));

  console.info(
    `[iconify-data] generated ${collectionPrefixes.length} collections and ${globalSearchIndex.manifest.entryCount} searchable entries`,
  );
  printGenerationStats(searchEntriesFile, searchEntriesJson, chunkStats);
}
