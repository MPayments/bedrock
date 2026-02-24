import { createSearchParamsCache } from "nuqs/server";
import { CUSTOMERS_LIST_CONTRACT } from "@bedrock/customers/validation";

import { createListSearchParamsParsersFromContract } from "@/lib/list-search-params";

export const searchParamsCache = createSearchParamsCache({
  ...createListSearchParamsParsersFromContract(CUSTOMERS_LIST_CONTRACT),
});

export type CustomersSearchParams = Awaited<
  ReturnType<typeof searchParamsCache.parse>
>;
