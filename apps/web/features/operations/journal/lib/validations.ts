import { ACCOUNTING_OPERATIONS_LIST_CONTRACT } from "@bedrock/app/accounting/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  ACCOUNTING_OPERATIONS_LIST_CONTRACT,
);

export type OperationsSearchParams = ResourceSearchParams;
