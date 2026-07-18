/* eslint-disable vite-plus/prefer-vite-plus-imports */
import { describe, expect, it } from "vitest";
import { LruCache } from "./lruCache";

describe("LruCache", () => {
  it("evicts the least recently used entry when capacity is exceeded", () => {
    const cache = new LruCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("refreshes recency on get", () => {
    const cache = new LruCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });

  it("updates an existing key without growing size", () => {
    const cache = new LruCache<number>(2);
    cache.set("a", 1);
    cache.set("a", 11);
    cache.set("b", 2);

    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBe(11);
  });
});
