import type { ListQueryContract } from "@bedrock/shared/core/pagination";
import { PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT } from "@bedrock/calculations/contracts";

import { createResourceSearchParamsCache } from "@/lib/resources/search-params";
import type { ResourceSearchParams } from "@/lib/resources/search-params";

export const PAYMENT_ROUTES_LIST_CONTRACT =
  PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT satisfies ListQueryContract<
    typeof PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT.sortableColumns,
    typeof PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT.filters
  >;

export const searchParamsCache = createResourceSearchParamsCache(
  PAYMENT_ROUTES_LIST_CONTRACT,
);

export type PaymentRoutesSearchParams = ResourceSearchParams & {
  name?: string | null;
  status?: string | null;
};

export type PaymentRoutesSortId =
  (typeof PAYMENT_ROUTE_TEMPLATES_LIST_CONTRACT.sortableColumns)[number];
