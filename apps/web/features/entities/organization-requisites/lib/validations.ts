import { REQUISITES_LIST_CONTRACT } from "@bedrock/core/requisites/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  REQUISITES_LIST_CONTRACT,
);

export type OrganizationRequisitesSearchParams = ResourceSearchParams;
