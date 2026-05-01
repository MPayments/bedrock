import { headers } from "next/headers";
import { z } from "zod";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import {
  CounterpartyOptionsResponseSchema,
  CUSTOMERS_LIST_CONTRACT,
  OrganizationOptionsResponseSchema,
} from "@bedrock/parties/contracts";

import { readOptionsList, readPaginatedList } from "@/lib/api/query";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { getServerApiClient } from "@/lib/api/server-client";
import { createResourceListQuery } from "@/lib/resources/search-params";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";

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
  documents?: {
    id: string;
    docType: string;
    label: string;
  }[];
};

const CustomerOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});
const CustomersListResponseSchema = createPaginatedResponseSchema(
  CustomerOptionSchema,
);
const DealDocumentOptionItemSchema = z.object({
  id: z.string(),
  docType: z.string(),
  docNo: z.string().nullish(),
  title: z.string().nullish(),
});
const DealDocumentOptionsResponseSchema = z.array(DealDocumentOptionItemSchema);

export function createEmptyDocumentFormOptions(): DocumentFormOptions {
  return {
    counterparties: [],
    customers: [],
    documents: [],
    organizations: [],
    currencies: [],
  };
}

function formatDealDocumentOptionLabel(
  document: z.infer<typeof DealDocumentOptionItemSchema>,
) {
  const title = document.title?.trim();
  const docNo = document.docNo?.trim();

  if (docNo && title) {
    return `${docNo} · ${title}`;
  }

  return docNo || title || document.id;
}

async function fetchDealDocumentOptions(dealId: string | null | undefined) {
  if (!dealId) {
    return null;
  }

  const requestHeaders = await headers();
  const response = await fetch(
    `${API_URL}/v1/deals/${encodeURIComponent(dealId)}/formal-documents`,
    {
      cache: "no-store",
      headers: {
        cookie: requestHeaders.get("cookie") ?? "",
        "x-bedrock-app-audience": "finance",
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  return DealDocumentOptionsResponseSchema.parse(await response.json());
}

export async function getDocumentFormOptions(input?: {
  dealId?: string | null;
}): Promise<DocumentFormOptions> {
  const client = await getServerApiClient();

  const [counterparties, customers, organizations, currencies, documents] =
    await Promise.allSettled([
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
      fetchDealDocumentOptions(input?.dealId),
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
            label: item.name,
          }))
        : emptyOptions.customers,
    documents:
      documents.status === "fulfilled" && documents.value
        ? documents.value.map((document) => ({
            id: document.id,
            docType: document.docType,
            label: formatDealDocumentOptionLabel(document),
          }))
        : emptyOptions.documents,
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
