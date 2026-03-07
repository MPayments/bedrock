import { ORGANIZATION_REQUISITES_LIST_CONTRACT } from "@bedrock/core/organization-requisites/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  ORGANIZATION_REQUISITES_LIST_CONTRACT,
);

export type OrganizationRequisitesSearchParams = ResourceSearchParams;
