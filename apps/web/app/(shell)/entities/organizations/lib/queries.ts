import { cache } from "react";

import { ORGANIZATIONS_LIST_CONTRACT } from "@bedrock/organizations/validation";

import { apiClient } from "@/lib/api-client";
import { createListQueryFromSearchParams } from "@/lib/list-search-params";
import type { Option } from "@/types/data-table";

import type { OrganizationsListResult } from "../components/table";
import { type OrganizationsSearchParams } from "./validations";

function createOrganizationsListQuery(search: OrganizationsSearchParams) {
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

interface OrganizationDetails {
  id: string;
  externalId: string | null;
  customerId: string | null;
  name: string;
  country: string | null;
  baseCurrency: string;
  isTreasury: boolean;
  createdAt: string;
  updatedAt: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getOrganizationByIdUncached = async (
  id: string,
): Promise<OrganizationDetails | null> => {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const res = await apiClient.v1.organizations[":id"].$get(
    {
      param: { id },
    },
    {
      init: { cache: "no-store" },
    },
  );

  const status = (res as Response).status;

  if (status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch organization: ${status}`);
  }

  const payload = await res.json();

  if (
    !payload ||
    typeof payload !== "object" ||
    !("id" in payload) ||
    typeof payload.id !== "string"
  ) {
    return null;
  }

  return payload as OrganizationDetails;
};

export const getOrganizationById = cache(getOrganizationByIdUncached);

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
