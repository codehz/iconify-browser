import { getIconData, iconToSVG, iconToHTML } from "@iconify/utils";
import type { IconifyJSON } from "@iconify/types";

export function renderIconHTML(collection: IconifyJSON, name: string): string | null {
  try {
    const iconData = getIconData(collection, name);
    if (!iconData) return null;
    const svgData = iconToSVG(iconData, { height: "100%" });
    return iconToHTML(svgData.body, svgData.attributes);
  } catch {
    return null;
  }
}

export function getIconNames(collection: IconifyJSON): string[] {
  const names = Object.keys(collection.icons);
  if (collection.aliases) {
    for (const alias of Object.keys(collection.aliases)) {
      if (!names.includes(alias)) {
        names.push(alias);
      }
    }
  }
  return names.sort();
}
