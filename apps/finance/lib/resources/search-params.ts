import { createSearchParamsCache } from "nuqs/server";

import {
  createListQueryFromSearchParams,
  createListSearchParamsParsersFromContract,
} from "@/lib/list-search-params";

type ListQueryContractLike = Parameters<
  typeof createListSearchParamsParsersFromContract
>[0];

export type ResourceSearchParams = {
  page?: number | null;
  perPage?: number | null;
  sort?: ReadonlyArray<{ id: string; desc: boolean }> | null;
  [key: string]: unknown;
};

type ResourceSearchParamsCache = {
  parse: (...args: unknown[]) => Promise<ResourceSearchParams>;
};

export function createResourceSearchParamsCache<
  TContract extends ListQueryContractLike,
>(
  contract: TContract,
  options?: {
    defaultPerPage?: number;
  },
): ResourceSearchParamsCache {
  return createSearchParamsCache({
    ...createListSearchParamsParsersFromContract(contract, options),
  }) as unknown as ResourceSearchParamsCache;
}

export function createResourceListQuery<TContract extends ListQueryContractLike>(
  contract: TContract,
  search: ResourceSearchParams,
) {
  return createListQueryFromSearchParams(contract, search);
}
