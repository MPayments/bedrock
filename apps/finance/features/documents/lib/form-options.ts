import { z } from "zod";

import {
  CounterpartyOptionsResponseSchema,
  OrganizationOptionsResponseSchema,
} from "@bedrock/parties/contracts";
import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import { CUSTOMERS_LIST_CONTRACT } from "@bedrock/parties/contracts";

import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { getServerApiClient } from "@/lib/api/server-client";
import { readOptionsList, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

export type DocumentFormCounterpartyOption = {
  id: string;
  label: string;
};

export type DocumentFormCurrencyOption = {
  id: string;
  code: string;
  label: string;
};

export type DocumentFormOptions = {
  counterparties: DocumentFormCounterpartyOption[];
  customers: DocumentFormCounterpartyOption[];
  organizations: DocumentFormCounterpartyOption[];
  currencies: DocumentFormCurrencyOption[];
};

const CustomerOptionSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
});
const CustomersListResponseSchema = createPaginatedResponseSchema(
  CustomerOptionSchema,
);

export function createEmptyDocumentFormOptions(): DocumentFormOptions {
  return {
    counterparties: [],
    customers: [],
    organizations: [],
    currencies: [],
  };
}

export async function getDocumentFormOptions(): Promise<DocumentFormOptions> {
  const client = await getServerApiClient();

  const [counterparties, customers, organizations, currencies] = await Promise.allSettled([
    readOptionsList({
      request: () =>
        client.v1.counterparties.options.$get(
          {},
          { init: { cache: "no-store" } },
        ),
      schema: CounterpartyOptionsResponseSchema,
      context: "Не удалось загрузить контрагентов",
    }),
    readPaginatedList({
      request: () =>
        client.v1.customers.$get(
          {
            query: createResourceListQuery(CUSTOMERS_LIST_CONTRACT, {
              page: 1,
              perPage: 200,
            }),
          },
          { init: { cache: "no-store" } },
        ),
      schema: CustomersListResponseSchema,
      context: "Не удалось загрузить клиентов",
    }),
    readOptionsList({
      request: () =>
        client.v1.organizations.options.$get(
          {},
          { init: { cache: "no-store" } },
        ),
      schema: OrganizationOptionsResponseSchema,
      context: "Не удалось загрузить организации",
    }),
    readOptionsList({
      request: () =>
        client.v1.currencies.options.$get(
          {},
          { init: { cache: "no-store" } },
        ),
      schema: CurrencyOptionsResponseSchema,
      context: "Не удалось загрузить валюты",
    }),
  ]);

  const emptyOptions = createEmptyDocumentFormOptions();

  return {
    counterparties:
      counterparties.status === "fulfilled"
        ? counterparties.value.data.map((item) => ({
            id: item.id,
            label: item.label,
          }))
        : emptyOptions.counterparties,
    customers:
      customers.status === "fulfilled"
        ? customers.value.data.data.map((item) => ({
            id: item.id,
            label: item.displayName,
          }))
        : emptyOptions.customers,
    organizations:
      organizations.status === "fulfilled"
        ? organizations.value.data.map((item) => ({
            id: item.id,
            label: item.label,
          }))
        : emptyOptions.organizations,
    currencies:
      currencies.status === "fulfilled"
        ? currencies.value.data.map((item) => ({
            id: item.id,
            code: item.code,
            label: item.label,
          }))
        : emptyOptions.currencies,
  };
}
