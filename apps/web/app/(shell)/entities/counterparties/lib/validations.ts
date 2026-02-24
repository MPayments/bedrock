import { createSearchParamsCache } from "nuqs/server";
import { COUNTERPARTIES_LIST_CONTRACT } from "@bedrock/counterparties/validation";

import { createListSearchParamsParsersFromContract } from "@/lib/list-search-params";

export const searchParamsCache = createSearchParamsCache({
  ...createListSearchParamsParsersFromContract(COUNTERPARTIES_LIST_CONTRACT),
});

export type CounterpartiesSearchParams = Awaited<
  ReturnType<typeof searchParamsCache.parse>
>;
