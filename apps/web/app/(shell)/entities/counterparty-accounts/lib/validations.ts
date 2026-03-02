import { COUNTERPARTY_ACCOUNTS_LIST_CONTRACT } from "@bedrock/core/counterparty-accounts/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  COUNTERPARTY_ACCOUNTS_LIST_CONTRACT,
);

export type AccountsSearchParams = ResourceSearchParams;
