import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { CurrencySchema } from "@bedrock/currencies/contracts";
import {
  CounterpartyOptionsResponseSchema,
  CustomerOptionsResponseSchema,
  OrganizationOptionsResponseSchema,
} from "@bedrock/parties/contracts";
import { MAX_QUERY_LIST_LIMIT, createPaginatedListSchema } from "@bedrock/shared/core/pagination";
import {
  PaymentRouteTemplateListResponseSchema,
  PaymentRouteTemplateSchema,
} from "@bedrock/treasury/contracts";

import { createResourceListQuery } from "@/lib/resources/search-params";
import { readEntityById, readOptionsList } from "@/lib/api/query";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";

import type { PaymentRouteCurrencyOption } from "./format";
import type { PaymentRoutesSearchParams } from "./validations";
import { PAYMENT_ROUTES_LIST_CONTRACT } from "./validations";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";
const PaginatedCurrenciesSchema = createPaginatedListSchema(CurrencySchema);

export type PaymentRouteTemplateListResponse = z.infer<
  typeof PaymentRouteTemplateListResponseSchema
>;
export type PaymentRouteTemplate = z.infer<typeof PaymentRouteTemplateSchema>;
export type PaymentRouteTemplateListItem = PaymentRouteTemplateListResponse["data"][number];
export type PaymentRouteConstructorOptions = {
  counterparties: z.infer<typeof CounterpartyOptionsResponseSchema>["data"];
  currencies: PaymentRouteCurrencyOption[];
  customers: z.infer<typeof CustomerOptionsResponseSchema>["data"];
  organizations: z.infer<typeof OrganizationOptionsResponseSchema>["data"];
};

async function fetchApi(path: string) {
  const requestHeaders = await headers();

  return fetch(`${API_URL}${path}`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
      "x-bedrock-app-audience": "finance",
    },
    cache: "no-store",
  });
}

function createListPath(search: PaymentRoutesSearchParams) {
  const query = createResourceListQuery(PAYMENT_ROUTES_LIST_CONTRACT, search);
  const params = new URLSearchParams();

  params.set("limit", String(query.limit));
  params.set("offset", String(query.offset));

  if (query.sortBy) {
    params.set("sortBy", query.sortBy);
  }

  if (query.sortOrder) {
    params.set("sortOrder", query.sortOrder);
  }

  if (typeof query.name === "string" && query.name.length > 0) {
    params.set("name", query.name);
  }

  if (typeof query.status === "string" && query.status.length > 0) {
    params.set("status", query.status);
  }

  return `/v1/payment-routes?${params.toString()}`;
}

const getPaymentRoutesListUncached = async (
  search: PaymentRoutesSearchParams = {},
) => {
  const response = await requestOk(
    await fetchApi(createListPath(search)),
    "Не удалось загрузить список маршрутов",
  );

  return readJsonWithSchema(response, PaymentRouteTemplateListResponseSchema);
};

const getPaymentRouteTemplateByIdUncached = async (id: string) =>
  readEntityById({
    id,
    request: (validId) => fetchApi(`/v1/payment-routes/${encodeURIComponent(validId)}`),
    schema: PaymentRouteTemplateSchema,
    resourceName: "маршрут",
  });

const getPaymentRouteConstructorOptionsUncached = async () => {
  const [customers, organizations, counterparties, currenciesResponse] =
    await Promise.all([
      readOptionsList({
        request: () => fetchApi("/v1/customers/options"),
        schema: CustomerOptionsResponseSchema,
        context: "Не удалось загрузить список клиентов",
      }),
      readOptionsList({
        request: () => fetchApi("/v1/organizations/options"),
        schema: OrganizationOptionsResponseSchema,
        context: "Не удалось загрузить список организаций",
      }),
      readOptionsList({
        request: () => fetchApi("/v1/counterparties/options"),
        schema: CounterpartyOptionsResponseSchema,
        context: "Не удалось загрузить список контрагентов",
      }),
      (async () => {
        const response = await requestOk(
          await fetchApi(
            `/v1/currencies?limit=${MAX_QUERY_LIST_LIMIT}&offset=0&sortBy=code&sortOrder=asc`,
          ),
          "Не удалось загрузить валюты",
        );

        return readJsonWithSchema(response, PaginatedCurrenciesSchema);
      })(),
    ]);

  return {
    counterparties: counterparties.data,
    currencies: currenciesResponse.data.map((currency) => ({
      code: currency.code,
      id: currency.id,
      label: `${currency.code} - ${currency.name}`,
      name: currency.name,
      precision: currency.precision,
    })),
    customers: customers.data,
    organizations: organizations.data,
  } satisfies PaymentRouteConstructorOptions;
};

export const getPaymentRoutesList = cache(getPaymentRoutesListUncached);
export const getPaymentRouteTemplateById = cache(
  getPaymentRouteTemplateByIdUncached,
);
export const getPaymentRouteConstructorOptions = cache(
  getPaymentRouteConstructorOptionsUncached,
);

