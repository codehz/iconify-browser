/// <reference lib="WebWorker" />

import { clientsClaim } from "workbox-core";
import { CacheExpiration } from "workbox-expiration";
import { cleanupOutdatedCaches, precacheAndRoute, type PrecacheEntry } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";
import {
  ICONIFY_CACHE_ENCODING_HEADER,
  ICONIFY_DATA_IMMUTABLE_CACHE_NAME,
  ICONIFY_DATA_IMMUTABLE_MAX_AGE_SECONDS,
  ICONIFY_DATA_IMMUTABLE_MAX_ENTRIES,
  ICONIFY_DATA_INDEX_CACHE_NAME,
  ICONIFY_GZIP_ENCODING,
  createServedIconifyHeaders,
  createStoredIconifyHeaders,
  isIconifyImmutablePath,
} from "./sw/iconifyImmutableCache";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

const iconifyImmutableExpiration = new CacheExpiration(ICONIFY_DATA_IMMUTABLE_CACHE_NAME, {
  maxEntries: ICONIFY_DATA_IMMUTABLE_MAX_ENTRIES,
  maxAgeSeconds: ICONIFY_DATA_IMMUTABLE_MAX_AGE_SECONDS,
});

void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname === "/iconify-data/index.json",
  new StaleWhileRevalidate({
    cacheName: ICONIFY_DATA_INDEX_CACHE_NAME,
  }),
);

registerRoute(
  ({ url, sameOrigin }) => sameOrigin && isIconifyImmutablePath(url.pathname),
  async ({ event, request }) => {
    const cache = await caches.open(ICONIFY_DATA_IMMUTABLE_CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      const isExpired = await iconifyImmutableExpiration.isURLExpired(request.url);
      if (!isExpired) {
        event.waitUntil(touchIconifyImmutableEntry(request.url));
        return restoreIconifyImmutableResponse(cachedResponse);
      }

      await cache.delete(request);
    }

    const networkResponse = await fetch(request);
    if (!networkResponse.ok) {
      return networkResponse;
    }

    event.waitUntil(cacheIconifyImmutableResponse(cache, request, networkResponse.clone()));
    return networkResponse;
  },
);

async function touchIconifyImmutableEntry(url: string) {
  await iconifyImmutableExpiration.updateTimestamp(url);
  await iconifyImmutableExpiration.expireEntries();
}

async function cacheIconifyImmutableResponse(cache: Cache, request: Request, response: Response) {
  try {
    const responseToCache = await createIconifyImmutableCacheResponse(response);
    await cache.put(request, responseToCache);
    await touchIconifyImmutableEntry(request.url);
  } catch {
    await cache.put(request, response);
    await touchIconifyImmutableEntry(request.url);
  }
}

async function createIconifyImmutableCacheResponse(response: Response) {
  if (!supportsCompressionStreams() || !response.body) {
    return response;
  }

  const headers = createStoredIconifyHeaders(response.headers);
  headers.set(ICONIFY_CACHE_ENCODING_HEADER, ICONIFY_GZIP_ENCODING);

  return new Response(response.body.pipeThrough(new CompressionStream(ICONIFY_GZIP_ENCODING)), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function restoreIconifyImmutableResponse(response: Response) {
  if (
    response.headers.get(ICONIFY_CACHE_ENCODING_HEADER) !== ICONIFY_GZIP_ENCODING ||
    !response.body
  ) {
    return response;
  }

  const headers = createServedIconifyHeaders(response.headers);
  return new Response(response.body.pipeThrough(new DecompressionStream(ICONIFY_GZIP_ENCODING)), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function supportsCompressionStreams() {
  return "CompressionStream" in self && "DecompressionStream" in self;
}
