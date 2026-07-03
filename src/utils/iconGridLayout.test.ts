/* eslint-disable vite-plus/prefer-vite-plus-imports */
import { describe, expect, it } from "vitest";
import { getIconGridColumnCount, getIconGridRowCount, getIconGridRowItems } from "./iconGridLayout";

describe("iconGridLayout", () => {
  it("keeps at least one column", () => {
    expect(getIconGridColumnCount(0)).toBe(1);
    expect(getIconGridColumnCount(40)).toBe(1);
  });

  it("derives responsive column counts from container width", () => {
    expect(getIconGridColumnCount(80)).toBe(1);
    expect(getIconGridColumnCount(164)).toBe(2);
    expect(getIconGridColumnCount(248)).toBe(3);
  });

  it("calculates row counts from item counts", () => {
    expect(getIconGridRowCount(0, 4)).toBe(0);
    expect(getIconGridRowCount(1, 4)).toBe(1);
    expect(getIconGridRowCount(9, 4)).toBe(3);
  });

  it("slices row items by column count", () => {
    const items = ["a", "b", "c", "d", "e"];

    expect(getIconGridRowItems(items, 0, 2)).toEqual(["a", "b"]);
    expect(getIconGridRowItems(items, 1, 2)).toEqual(["c", "d"]);
    expect(getIconGridRowItems(items, 2, 2)).toEqual(["e"]);
  });
});
