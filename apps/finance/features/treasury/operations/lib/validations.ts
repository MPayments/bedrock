import { TREASURY_OPERATIONS_LIST_CONTRACT } from "@bedrock/treasury/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  TREASURY_OPERATIONS_LIST_CONTRACT,
);

export type TreasuryOperationsSearchParams = ResourceSearchParams;
