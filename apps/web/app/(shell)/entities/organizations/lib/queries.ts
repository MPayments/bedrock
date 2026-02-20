import { apiClient } from "@/lib/api-client";
import {
  getListPaginationQuery,
  getListSortQuery,
} from "@/lib/list-search-params";

import type { OrganizationsListResult } from "../(table)";
import {
  ORGANIZATIONS_SORTABLE_COLUMNS,
  type OrganizationsSearchParams,
} from "./validations";

function getFirstValue(values: string[]) {
  return values[0];
}

export function createOrganizationsListQuery(search: OrganizationsSearchParams) {
  const pagination = getListPaginationQuery({
    page: search.page ?? 1,
    perPage: search.perPage ?? 10,
  });
  const sorting = getListSortQuery(
    search.sort ?? [],
    ORGANIZATIONS_SORTABLE_COLUMNS,
  );

  const baseCurrency = getFirstValue(search.baseCurrency);
  const isTreasury = getFirstValue(search.isTreasury);

  return {
    ...pagination,
    ...sorting,
    name: search.name || undefined,
    country: search.country || undefined,
    baseCurrency: baseCurrency || undefined,
    isTreasury: isTreasury ? isTreasury === "true" : undefined,
  };
}

export async function getOrganizations(
  search: OrganizationsSearchParams,
): Promise<OrganizationsListResult> {
  const res = await apiClient.v1.organizations.$get(
    {
      query: createOrganizationsListQuery(search),
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch organizations: ${res.status}`);
  }

  return res.json() as Promise<OrganizationsListResult>;
}
