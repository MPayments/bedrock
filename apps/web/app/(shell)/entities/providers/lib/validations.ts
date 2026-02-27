import { PROVIDERS_LIST_CONTRACT } from "@bedrock/operational-accounts/validation";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  PROVIDERS_LIST_CONTRACT,
);

export type ProvidersSearchParams = ResourceSearchParams;
