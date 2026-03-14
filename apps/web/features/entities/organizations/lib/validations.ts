import { ORGANIZATIONS_LIST_CONTRACT } from "@bedrock/organizations/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  ORGANIZATIONS_LIST_CONTRACT,
);

export type OrganizationsSearchParams = ResourceSearchParams;
