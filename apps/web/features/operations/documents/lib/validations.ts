import { DOCUMENTS_LIST_CONTRACT } from "@multihansa/documents/contracts";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  DOCUMENTS_LIST_CONTRACT,
);

export type OperationsSearchParams = ResourceSearchParams;
