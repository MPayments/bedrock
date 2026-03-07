import { COUNTERPARTY_REQUISITES_LIST_CONTRACT } from "@bedrock/core/counterparty-requisites/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  COUNTERPARTY_REQUISITES_LIST_CONTRACT,
);

export type CounterpartyRequisitesSearchParams = ResourceSearchParams;
