import { CURRENCIES_LIST_CONTRACT } from "@bedrock/finance/assets/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  CURRENCIES_LIST_CONTRACT,
);

export type CurrenciesSearchParams = ResourceSearchParams;
