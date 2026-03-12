import { COUNTERPARTIES_LIST_CONTRACT } from "@bedrock/app/counterparties/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  COUNTERPARTIES_LIST_CONTRACT,
);

export type CounterpartiesSearchParams = ResourceSearchParams;
