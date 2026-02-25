import { PROVIDERS_LIST_CONTRACT } from "@bedrock/accounts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  PROVIDERS_LIST_CONTRACT,
);

export type ProvidersSearchParams = ResourceSearchParams;
