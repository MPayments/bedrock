import {
  createResourceSearchParamsCache,
  type ResourceSearchParams,
} from "@/lib/resources/search-params";
import { REQUISITES_LIST_CONTRACT } from "@/features/entities/requisites-shared/lib/contracts";

export const searchParamsCache = createResourceSearchParamsCache(
  REQUISITES_LIST_CONTRACT,
);

export type RequisitesSearchParams = ResourceSearchParams;
