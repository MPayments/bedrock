import { cache } from "react";

import { COUNTERPARTIES_LIST_CONTRACT } from "@bedrock/counterparties/validation";

import { getServerApiClient } from "@/lib/api-client.server";
import { createListQueryFromSearchParams } from "@/lib/list-search-params";

import type { CounterpartiesListResult } from "../components/counterparties-table";
import { type CounterpartiesSearchParams } from "./validations";

function createCounterpartiesListQuery(search: CounterpartiesSearchParams) {
  return createListQueryFromSearchParams(COUNTERPARTIES_LIST_CONTRACT, search);
}

export async function getCounterparties(
  search: CounterpartiesSearchParams,
): Promise<CounterpartiesListResult> {
  const client = await getServerApiClient();
  const res = await client.v1.counterparties.$get(
    {
      query: createCounterpartiesListQuery(search),
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch counterparties: ${res.status}`);
  }

  return res.json() as Promise<CounterpartiesListResult>;
}

export interface CounterpartyDetails {
  id: string;
  externalId: string | null;
  customerId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: string | null;
  kind: "legal_entity" | "individual";
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CounterpartyGroupOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  customerId: string | null;
  isSystem: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getCounterpartyByIdUncached = async (
  id: string,
): Promise<CounterpartyDetails | null> => {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const client = await getServerApiClient();
  const res = await client.v1.counterparties[":id"].$get(
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
    throw new Error(`Failed to fetch counterparty: ${status}`);
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

  return payload as CounterpartyDetails;
};

export const getCounterpartyById = cache(getCounterpartyByIdUncached);

export async function getCounterpartyGroups(): Promise<CounterpartyGroupOption[]> {
  const client = await getServerApiClient();
  const res = await client.v1["counterparty-groups"].$get(
    {
      query: {},
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch counterparty groups: ${res.status}`);
  }

  return (await res.json()) as CounterpartyGroupOption[];
}
