import { QUOTES_LIST_CONTRACT } from "@bedrock/treasury/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  QUOTES_LIST_CONTRACT,
);

export type FxQuotesSearchParams = ResourceSearchParams;
