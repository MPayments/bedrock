import { USERS_LIST_CONTRACT } from "@bedrock/users/validation";

import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";

export const searchParamsCache = createResourceSearchParamsCache(
  USERS_LIST_CONTRACT,
);

export type UsersSearchParams = ResourceSearchParams;
