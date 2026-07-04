/* eslint-disable vite-plus/prefer-vite-plus-imports */
import { describe, expect, it } from "vitest";
import {
  ICONIFY_CACHE_ENCODING_HEADER,
  createServedIconifyHeaders,
  createStoredIconifyHeaders,
  isIconifyImmutablePath,
} from "./iconifyImmutableCache";

describe("iconifyImmutableCache", () => {
  it("matches only hashed Iconify JSON assets", () => {
    expect(
      isIconifyImmutablePath("/iconify-data/collections/carbon/chunk-0.f6795c315aa6.json"),
    ).toBe(true);
    expect(isIconifyImmutablePath("/iconify-data/search/entries.c1bf805aed24.json")).toBe(true);
    expect(isIconifyImmutablePath("/iconify-data/index.json")).toBe(false);
    expect(isIconifyImmutablePath("/iconify-data/_meta.json")).toBe(false);
    expect(isIconifyImmutablePath("/iconify-data/collections/carbon/chunk-0.json")).toBe(false);
  });

  it("drops transport-only headers before storing compressed payloads", () => {
    const headers = createStoredIconifyHeaders(
      new Headers({
        "content-encoding": "br",
        "content-length": "123",
        "content-range": "bytes 0-122/123",
        "content-type": "application/json",
      }),
    );

    expect(headers.get("content-encoding")).toBeNull();
    expect(headers.get("content-length")).toBeNull();
    expect(headers.get("content-range")).toBeNull();
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("strips internal cache metadata before serving a cached response", () => {
    const headers = createServedIconifyHeaders(
      new Headers({
        "content-type": "application/json",
        [ICONIFY_CACHE_ENCODING_HEADER]: "gzip",
      }),
    );

    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get(ICONIFY_CACHE_ENCODING_HEADER)).toBeNull();
  });
});
