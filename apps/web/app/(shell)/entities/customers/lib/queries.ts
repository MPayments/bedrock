import { cache } from "react";
import { z } from "zod";

import { CUSTOMERS_LIST_CONTRACT } from "@bedrock/customers/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { CustomersListResult } from "../components/customers-table";
import type { CustomersSearchParams } from "./validations";

const CustomerResponseSchema = z.object({
  id: z.uuid(),
  externalRef: z.string().nullable(),
  displayName: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const CustomersListResponseSchema = createPaginatedResponseSchema(
  CustomerResponseSchema,
);

function createCustomersListQuery(search: CustomersSearchParams) {
  return createResourceListQuery(CUSTOMERS_LIST_CONTRACT, search);
}

export async function getCustomers(
  search: CustomersSearchParams,
): Promise<CustomersListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.customers.$get(
        {
          query: createCustomersListQuery(search),
        },
        {
          init: { cache: "no-store" },
        },
      ),
    schema: CustomersListResponseSchema,
    context: "Не удалось загрузить клиентов",
  });

  return data;
}

export type CustomerDetails = z.infer<typeof CustomerResponseSchema>;

const getCustomerByIdUncached = async (
  id: string,
): Promise<CustomerDetails | null> => {
  return readEntityById({
    id,
    resourceName: "клиента",
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
    schema: CustomerResponseSchema,
  });
};

export const getCustomerById = cache(getCustomerByIdUncached);
