/* eslint-disable vite-plus/prefer-vite-plus-imports */
import { describe, expect, it } from "vitest";
import type { GlobalSearchSelection } from "../types";
import {
  getBrowseSelectionFromSelection,
  getDetailSelectionForView,
  toggleBrowseDetailSelection,
  toggleGlobalDetailSelection,
} from "./viewState";

describe("viewState", () => {
  it("toggles browse detail selection by icon identity", () => {
    const first = toggleBrowseDetailSelection(null, "demo", "Demo", "home");
    const second = toggleBrowseDetailSelection(first, "demo", "Demo", "home");
    const third = toggleBrowseDetailSelection(first, "demo", "Demo", "user");

    expect(first).toEqual({
      kind: "browse",
      prefix: "demo",
      collectionName: "Demo",
      name: "home",
    });
    expect(second).toBeNull();
    expect(third).toEqual({
      kind: "browse",
      prefix: "demo",
      collectionName: "Demo",
      name: "user",
    });
  });

  it("toggles global detail selection by prefix, chunk, and name", () => {
    const selection: GlobalSearchSelection = {
      kind: "global-search",
      prefix: "solar",
      collectionName: "Solar",
      name: "sun",
      chunkId: 0,
      isAlias: false,
    };

    expect(toggleGlobalDetailSelection(null, selection)).toEqual(selection);
    expect(toggleGlobalDetailSelection(selection, selection)).toBeNull();
  });

  it("drops detail state when switching to a mismatched main view", () => {
    const browseSelection = {
      kind: "browse" as const,
      prefix: "demo",
      collectionName: "Demo",
      name: "home",
    };
    const globalSelection: GlobalSearchSelection = {
      kind: "global-search",
      prefix: "solar",
      collectionName: "Solar",
      name: "sun",
      chunkId: 0,
      isAlias: false,
    };

    expect(getDetailSelectionForView(browseSelection, "browse")).toEqual(browseSelection);
    expect(getDetailSelectionForView(browseSelection, "global-search")).toBeNull();
    expect(getDetailSelectionForView(globalSelection, "browse")).toBeNull();
    expect(getDetailSelectionForView(globalSelection, "global-search")).toEqual(globalSelection);
  });

  it("converts any selection into a browse selection when opening the collection view", () => {
    const globalSelection: GlobalSearchSelection = {
      kind: "global-search",
      prefix: "solar",
      collectionName: "Solar",
      name: "sun",
      chunkId: 0,
      isAlias: true,
    };

    expect(getBrowseSelectionFromSelection(globalSelection)).toEqual({
      kind: "browse",
      prefix: "solar",
      collectionName: "Solar",
      name: "sun",
    });
  });
});
