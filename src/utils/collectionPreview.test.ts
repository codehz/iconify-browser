/* eslint-disable vite-plus/prefer-vite-plus-imports */
import { describe, expect, it } from "vitest";
import {
  buildCategoryNameSet,
  countIconsBySuffix,
  getCollectionCategoryEntries,
  getCollectionSuffixEntries,
  getIconSuffixKey,
} from "./collectionPreview";

describe("collectionPreview", () => {
  it("reads suffix entries from collection metadata", () => {
    expect(
      getCollectionSuffixEntries({
        suffixes: {
          outline: "Outline",
          solid: "Solid",
        },
      }),
    ).toEqual([
      ["outline", "Outline"],
      ["solid", "Solid"],
    ]);
  });

  it("matches icons to suffixes", () => {
    expect(
      getIconSuffixKey("home-outline", [
        ["outline", "Outline"],
        ["filled", "Filled"],
      ]),
    ).toBe("outline");
    expect(
      getIconSuffixKey("home-filled", [
        ["outline", "Outline"],
        ["filled", "Filled"],
      ]),
    ).toBe("filled");
  });

  it("matches the longest suffix before shorter overlapping ones", () => {
    expect(
      getIconSuffixKey("person-outline-rounded", [
        ["outline", "Outline"],
        ["outline-rounded", "Outline Rounded"],
      ]),
    ).toBe("outline-rounded");
    expect(
      getIconSuffixKey("person-outline", [
        ["outline", "Outline"],
        ["outline-rounded", "Outline Rounded"],
      ]),
    ).toBe("outline");
  });

  it("uses the empty suffix for default icons", () => {
    expect(
      getIconSuffixKey("book", [
        ["", "Regular"],
        ["square", "Square"],
      ]),
    ).toBe("");
    expect(
      getIconSuffixKey("book-square", [
        ["", "Regular"],
        ["square", "Square"],
      ]),
    ).toBe("square");
  });

  it("ignores unmatched icons when no default suffix exists", () => {
    expect(getIconSuffixKey("foo", [["outline", "Outline"]])).toBeNull();
  });

  it("counts icons for each suffix", () => {
    const counts = countIconsBySuffix(
      ["book", "book-square", "news-square", "mail"],
      [
        ["", "Regular"],
        ["square", "Square"],
      ],
    );

    expect(Array.from(counts.entries())).toEqual([
      ["", 2],
      ["square", 2],
    ]);
  });

  it("reads category entries from collection metadata", () => {
    expect(
      getCollectionCategoryEntries({
        categories: {
          Navigation: ["home", "user"],
          Files: ["file"],
        },
      }),
    ).toEqual([
      ["Navigation", ["home", "user"]],
      ["Files", ["file"]],
    ]);
  });

  it("expands category names to include aliases of categorized icons", () => {
    const names = buildCategoryNameSet(["user"], {
      "user-outline": { parent: "user" },
      "user-outline-rtl": { parent: "user-outline" },
      orphan: { parent: "missing" },
    });

    expect(Array.from(names).sort()).toEqual(["user", "user-outline", "user-outline-rtl"]);
  });
});
