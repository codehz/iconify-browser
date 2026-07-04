export const ICONIFY_DATA_INDEX_CACHE_NAME = "iconify-data-index";
export const ICONIFY_DATA_IMMUTABLE_CACHE_NAME = "iconify-data-immutable";
export const ICONIFY_DATA_IMMUTABLE_MAX_ENTRIES = 640;
export const ICONIFY_DATA_IMMUTABLE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const ICONIFY_CACHE_ENCODING_HEADER = "x-iconify-cache-encoding";
export const ICONIFY_GZIP_ENCODING = "gzip";

const ICONIFY_IMMUTABLE_PATH_PATTERN = /^\/iconify-data\/.*\.[0-9a-f]{12}\.json$/;

export function isIconifyImmutablePath(pathname: string) {
  return ICONIFY_IMMUTABLE_PATH_PATTERN.test(pathname);
}

export function createStoredIconifyHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("content-range");
  return headers;
}

export function createServedIconifyHeaders(source: Headers): Headers {
  const headers = createStoredIconifyHeaders(source);
  headers.delete(ICONIFY_CACHE_ENCODING_HEADER);
  return headers;
}
