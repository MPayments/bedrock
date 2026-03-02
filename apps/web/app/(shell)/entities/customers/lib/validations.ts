import { CUSTOMERS_LIST_CONTRACT } from "@bedrock/core/customers/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  CUSTOMERS_LIST_CONTRACT,
);

export type CustomersSearchParams = ResourceSearchParams;
