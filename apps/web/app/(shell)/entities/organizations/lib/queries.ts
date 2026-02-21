import { ORGANIZATIONS_LIST_CONTRACT } from "@bedrock/organizations";

import { apiClient } from "@/lib/api-client";
import { createListQueryFromSearchParams } from "@/lib/list-search-params";
import type { Option } from "@/types/data-table";

import type { OrganizationsListResult } from "../(table)";
import { type OrganizationsSearchParams } from "./validations";

export function createOrganizationsListQuery(search: OrganizationsSearchParams) {
  return createListQueryFromSearchParams(ORGANIZATIONS_LIST_CONTRACT, search);
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

interface CurrenciesFilterListResult {
  data: Array<{
    code: string;
    name: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export async function getOrganizationCurrencyFilterOptions(): Promise<Option[]> {
  const pageSize = 100;
  let offset = 0;
  const codes = new Set<string>();
  const options: Option[] = [];

  while (true) {
    const res = await apiClient.v1.currencies.$get(
      {
        query: {
          limit: pageSize,
          offset,
          sortBy: "code",
          sortOrder: "asc",
        },
      },
      {
        init: { cache: "no-store" },
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch currencies for organizations filter: ${res.status}`);
    }

    const list = (await res.json()) as CurrenciesFilterListResult;

    for (const currency of list.data) {
      if (codes.has(currency.code)) continue;
      codes.add(currency.code);
      options.push({
        value: currency.code,
        label: currency.code,
      });
    }

    offset += list.data.length;
    if (offset >= list.total || list.data.length === 0) {
      break;
    }
  }

  return options;
}
