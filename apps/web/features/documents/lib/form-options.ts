import { z } from "zod";

import {
  COUNTERPARTIES_LIST_CONTRACT,
  CounterpartyGroupOptionsResponseSchema,
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
  customerIds: string[];
};

export type DocumentFormCustomerOption = {
  id: string;
  label: string;
};

export type DocumentFormOrganizationOption = {
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
  customers: DocumentFormCustomerOption[];
  organizations: DocumentFormOrganizationOption[];
  currencies: DocumentFormCurrencyOption[];
};

const CustomerOptionSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
});
const CounterpartyOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  groupIds: z.array(z.uuid()),
});
const CustomersListResponseSchema = createPaginatedResponseSchema(
  CustomerOptionSchema,
);
const CounterpartiesListResponseSchema = createPaginatedResponseSchema(
  CounterpartyOptionSchema,
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

  const [counterparties, counterpartyGroups, customers, organizations, currencies] =
    await Promise.allSettled([
      readPaginatedList({
        request: () =>
          client.v1.counterparties.$get(
            {
              query: createResourceListQuery(COUNTERPARTIES_LIST_CONTRACT, {
                page: 1,
                perPage: 200,
                sortBy: "shortName",
                sortOrder: "asc",
              }),
            },
            { init: { cache: "no-store" } },
          ),
        schema: CounterpartiesListResponseSchema,
        context: "Не удалось загрузить контрагентов",
      }),
      readOptionsList({
        request: () =>
          client.v1["counterparty-groups"].options.$get(
            {},
            { init: { cache: "no-store" } },
          ),
        schema: CounterpartyGroupOptionsResponseSchema,
        context: "Не удалось загрузить группы контрагентов",
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
  const customerIdByGroupId = new Map(
    counterpartyGroups.status === "fulfilled"
      ? counterpartyGroups.value.data
          .filter(
            (group): group is (typeof counterpartyGroups.value.data)[number] & {
              customerId: string;
            } => typeof group.customerId === "string" && group.customerId.length > 0,
          )
          .map((group) => [group.id, group.customerId] as const)
      : [],
  );

  return {
    counterparties:
      counterparties.status === "fulfilled"
        ? counterparties.value.data.data.map((item) => ({
            id: item.id,
            label: item.shortName,
            customerIds: (() => {
              return Array.from(
                new Set(
                  item.groupIds.flatMap((groupId) => {
                    const customerId = customerIdByGroupId.get(groupId);
                    return customerId ? [customerId] : [];
                  }),
                ),
              );
            })(),
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
