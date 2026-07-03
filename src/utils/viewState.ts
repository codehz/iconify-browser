import type { BrowseSelection, GlobalSearchSelection, IconSelection } from "../types";

export type MainView = "browse" | "global-search";

export function toggleBrowseDetailSelection(
  current: IconSelection | null,
  prefix: string,
  collectionName: string,
  name: string,
): IconSelection | null {
  if (current?.kind === "browse" && current.prefix === prefix && current.name === name) {
    return null;
  }

  const nextSelection: BrowseSelection = {
    kind: "browse",
    prefix,
    name,
    collectionName,
  };
  return nextSelection;
}

export function toggleGlobalDetailSelection(
  current: IconSelection | null,
  selection: GlobalSearchSelection,
): IconSelection | null {
  if (
    current?.kind === "global-search" &&
    current.prefix === selection.prefix &&
    current.chunkId === selection.chunkId &&
    current.name === selection.name
  ) {
    return null;
  }

  return selection;
}

export function getDetailSelectionForView(
  current: IconSelection | null,
  nextView: MainView,
): IconSelection | null {
  if (!current) {
    return null;
  }

  if (nextView === "browse" && current.kind !== "browse") {
    return null;
  }

  if (nextView === "global-search" && current.kind !== "global-search") {
    return null;
  }

  return current;
}

export function getBrowseSelectionFromSelection(selection: IconSelection): BrowseSelection {
  return {
    kind: "browse",
    prefix: selection.prefix,
    name: selection.name,
    collectionName: selection.collectionName,
  };
}
