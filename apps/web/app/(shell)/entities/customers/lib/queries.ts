import { cache } from "react";

import { CUSTOMERS_LIST_CONTRACT } from "@bedrock/customers/contracts";

import { getServerApiClient } from "@/lib/api-client.server";
import { createResourceListQuery } from "@/lib/resources/search-params";
import { readResourceById } from "@/lib/resources/http";

import type { CustomersListResult } from "../components/customers-table";
import type { CustomersSearchParams } from "./validations";

function createCustomersListQuery(search: CustomersSearchParams) {
  return createResourceListQuery(CUSTOMERS_LIST_CONTRACT, search);
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
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

const getCustomerByIdUncached = async (
  id: string,
): Promise<CustomerDetails | null> => {
  return readResourceById<CustomerDetails>({
    id,
    resourceName: "customer",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.customers[":id"].$get(
        {
          param: { id: validId },
        },
        {
          init: { cache: "no-store" },
        },
      );
    },
  });
};

export const getCustomerById = cache(getCustomerByIdUncached);
