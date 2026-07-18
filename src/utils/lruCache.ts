/**
 * Simple string-key LRU cache. `get` refreshes recency; `set` evicts oldest when over capacity.
 */
export class LruCache<V> {
  private readonly map = new Map<string, V>();
  private readonly maxEntries: number;

  constructor(maxEntries: number) {
    if (maxEntries <= 0) {
      throw new Error("LruCache maxEntries must be positive");
    }
    this.maxEntries = maxEntries;
  }

  get size() {
    return this.map.size;
  }

  get(key: string): V | undefined {
    if (!this.map.has(key)) {
      return undefined;
    }

    const value = this.map.get(key) as V;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    this.map.set(key, value);

    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }
}
