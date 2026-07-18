import { wrap, type Remote } from "comlink";
import type { GlobalSearchHit } from "../types";
import type { GlobalSearchWorkerApi } from "../workers/globalSearch.worker";
import GlobalSearchWorker from "../workers/globalSearch.worker?worker";

export interface GlobalSearchClientOptions {
  prefixes?: readonly string[] | Set<string>;
  limit?: number;
  signal?: AbortSignal;
}

let worker: Worker | null = null;
let remote: Remote<GlobalSearchWorkerApi> | null = null;
let requestSeq = 0;

function getRemote() {
  if (!remote) {
    worker = new GlobalSearchWorker();
    remote = wrap<GlobalSearchWorkerApi>(worker);
  }

  return remote;
}

function toPrefixList(prefixes?: readonly string[] | Set<string>): string[] | undefined {
  if (!prefixes) {
    return undefined;
  }

  if (prefixes instanceof Set) {
    return prefixes.size > 0 ? Array.from(prefixes) : undefined;
  }

  return prefixes.length > 0 ? Array.from(prefixes) : undefined;
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

/**
 * Search icons off the main thread via a dedicated Worker (Comlink RPC).
 * Stale results from superseded queries are discarded with AbortError semantics.
 */
export async function searchIconsInWorker(
  query: string,
  options?: GlobalSearchClientOptions,
): Promise<GlobalSearchHit[]> {
  assertNotAborted(options?.signal);

  const normalized = query.trim();
  if (!normalized) {
    return [];
  }

  const seq = ++requestSeq;
  const api = getRemote();

  const hits = await api.search(normalized, {
    prefixes: toPrefixList(options?.prefixes),
    limit: options?.limit,
  });

  assertNotAborted(options?.signal);

  if (seq !== requestSeq) {
    throw new DOMException("Aborted", "AbortError");
  }

  return hits;
}

export function warmGlobalSearchWorker() {
  void getRemote()
    .warm()
    .catch(() => {
      // Warmup is best-effort; the next search will surface real errors.
    });
}

export function terminateGlobalSearchWorker() {
  requestSeq += 1;
  worker?.terminate();
  worker = null;
  remote = null;
}
