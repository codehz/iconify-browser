/// <reference lib="WebWorker" />
import { expose } from "comlink";
import {
  loadGlobalSearchIndex,
  searchGlobalSearchIndex,
  type GlobalSearchQueryOptions,
} from "../data/globalSearch";
import type { GlobalSearchHit } from "../types";

export interface GlobalSearchWorkerApi {
  warm(): Promise<void>;
  search(
    query: string,
    options?: Pick<GlobalSearchQueryOptions, "prefixes" | "limit">,
  ): Promise<GlobalSearchHit[]>;
}

const api: GlobalSearchWorkerApi = {
  async warm() {
    await loadGlobalSearchIndex();
  },

  async search(query, options) {
    const index = await loadGlobalSearchIndex();
    return searchGlobalSearchIndex(index, query, options?.limit, options?.prefixes);
  },
};

expose(api);
