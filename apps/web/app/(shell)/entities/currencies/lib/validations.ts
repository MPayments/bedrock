import { createSearchParamsCache } from "nuqs/server";
import { CURRENCIES_LIST_CONTRACT } from "@bedrock/currencies";

import { createListSearchParamsParsersFromContract } from "@/lib/list-search-params";

export const searchParamsCache = createSearchParamsCache({
  ...createListSearchParamsParsersFromContract(CURRENCIES_LIST_CONTRACT),
});

export type CurrenciesSearchParams = Awaited<ReturnType<typeof searchParamsCache.parse>>;
