import { REQUISITE_PROVIDERS_LIST_CONTRACT } from "@bedrock/requisite-providers/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  REQUISITE_PROVIDERS_LIST_CONTRACT,
);

export type RequisiteProvidersSearchParams = ResourceSearchParams;
