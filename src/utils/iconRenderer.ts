import { getIconData, iconToSVG, iconToHTML } from "@iconify/utils";
import type { IconifyJSON } from "@iconify/types";

const htmlCache = new WeakMap<IconifyJSON, Map<string, string | null>>();

export function renderIconHTML(collection: IconifyJSON, name: string): string | null {
  const cachedCollection = htmlCache.get(collection);
  const cachedHtml = cachedCollection?.get(name);
  if (cachedHtml !== undefined) {
    return cachedHtml;
  }

  try {
    const iconData = getIconData(collection, name);
    if (!iconData) {
      getOrCreateHtmlCache(collection).set(name, null);
      return null;
    }
    const svgData = iconToSVG(iconData, { height: "100%" });
    const html = iconToHTML(svgData.body, svgData.attributes);
    getOrCreateHtmlCache(collection).set(name, html);
    return html;
  } catch {
    getOrCreateHtmlCache(collection).set(name, null);
    return null;
  }
}

export function getIconNames(collection: IconifyJSON): string[] {
  const names = new Set(Object.keys(collection.icons));

  for (const alias of Object.keys(collection.aliases ?? {})) {
    names.add(alias);
  }

  return Array.from(names).sort();
}

function getOrCreateHtmlCache(collection: IconifyJSON) {
  let cache = htmlCache.get(collection);
  if (!cache) {
    cache = new Map<string, string | null>();
    htmlCache.set(collection, cache);
  }

  return cache;
}
