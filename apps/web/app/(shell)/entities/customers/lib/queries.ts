import { cache } from "react";

import { CUSTOMERS_LIST_CONTRACT } from "@bedrock/customers/validation";

import { getServerApiClient } from "@/lib/api-client.server";
import { createListQueryFromSearchParams } from "@/lib/list-search-params";

import type { CustomersListResult } from "../components/table";
import type { CustomersSearchParams } from "./validations";

function createCustomersListQuery(search: CustomersSearchParams) {
  return createListQueryFromSearchParams(CUSTOMERS_LIST_CONTRACT, search);
}

export async function getCustomers(
  search: CustomersSearchParams,
): Promise<CustomersListResult> {
  const client = await getServerApiClient();
  const res = await client.v1.customers.$get(
    {
      query: createCustomersListQuery(search),
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch customers: ${res.status}`);
  }

  return res.json() as Promise<CustomersListResult>;
}

export interface CustomerDetails {
  id: string;
  externalRef: string | null;
  displayName: string;
  createdAt: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getCustomerByIdUncached = async (
  id: string,
): Promise<CustomerDetails | null> => {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const client = await getServerApiClient();
  const res = await client.v1.customers[":id"].$get(
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
    throw new Error(`Failed to fetch customer: ${status}`);
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

  return payload as CustomerDetails;
};

export const getCustomerById = cache(getCustomerByIdUncached);
