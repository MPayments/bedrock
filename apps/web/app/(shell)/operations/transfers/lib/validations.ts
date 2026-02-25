import { TRANSFERS_LIST_CONTRACT } from "@bedrock/transfers/validation";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  TRANSFERS_LIST_CONTRACT,
);

export type TransfersSearchParams = ResourceSearchParams;
