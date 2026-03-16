import { FX_QUOTES_LIST_CONTRACT } from "@bedrock/fx/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  FX_QUOTES_LIST_CONTRACT,
);

export type FxQuotesSearchParams = ResourceSearchParams;
