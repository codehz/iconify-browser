import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR = path.join("public", "iconify-data");
const SCHEMA_VERSION = 1;
const CHUNK_TARGET_BYTES = 24 * 1024 * 1024;

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

interface GeneratedCollectionManifest {
  version: number;
  prefix: string;
  iconCount: number;
  aliasCount: number;
  base: Record<string, unknown>;
  chunks: string[];
}

interface GenerationMeta {
  schemaVersion: number;
  packageVersion: string;
  chunkTargetBytes: number;
  collectionCount: number;
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

function createIconChunks(icons: Record<string, unknown>) {
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
    const nextChunkIndex = iconChunks.length;

    if (currentSize > 2 && currentSize + entrySize > CHUNK_TARGET_BYTES) {
      flush();
    }

    currentIcons[name] = data;
    iconChunkMap.set(name, nextChunkIndex);
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
  if (!aliases) {
    return;
  }

  const aliasChunkMap = new Map<string, number>();

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
}

function shardCollection(collection: IconifyCollectionSource) {
  const { iconChunks, iconChunkMap } = createIconChunks(collection.icons);
  assignAliasesToChunks(collection.aliases, iconChunks, iconChunkMap);

  const manifest: GeneratedCollectionManifest = {
    version: SCHEMA_VERSION,
    prefix: collection.prefix,
    iconCount: Object.keys(collection.icons).length,
    aliasCount: Object.keys(collection.aliases ?? {}).length,
    base: getBaseCollectionData(collection),
    chunks: iconChunks.map((_, index) => `chunk-${index}.json`),
  };

  return { manifest, chunks: iconChunks };
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
  await writeFile(path.join(outputDir, "collections.json"), JSON.stringify(collections));

  for (const prefix of collectionPrefixes) {
    const sourcePath = path.join(jsonDir, `${prefix}.json`);
    const collection = await readJsonFile<IconifyCollectionSource>(sourcePath);
    const { manifest, chunks } = shardCollection(collection);
    const collectionDir = path.join(outputDir, "collections", prefix);

    await mkdir(collectionDir, { recursive: true });
    await writeFile(path.join(collectionDir, "manifest.json"), JSON.stringify(manifest));

    for (const [index, chunk] of chunks.entries()) {
      await writeFile(path.join(collectionDir, `chunk-${index}.json`), JSON.stringify(chunk));
    }
  }

  await writeFile(path.join(outputDir, "_meta.json"), JSON.stringify(nextMeta));
}
