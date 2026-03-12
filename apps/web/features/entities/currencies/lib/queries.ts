import { cache } from "react";
import { z } from "zod";

import { CURRENCIES_LIST_CONTRACT } from "@bedrock/app/currencies/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { CurrenciesListResult } from "./types";
import type { CurrenciesSearchParams } from "./validations";

const CurrencyListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string(),
  symbol: z.string(),
  precision: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

const CurrenciesListResponseSchema = createPaginatedResponseSchema(
  CurrencyListItemSchema,
);

const CurrencyDetailsSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string(),
  symbol: z.string(),
  precision: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

function createCurrenciesListQuery(search: CurrenciesSearchParams) {
  return createResourceListQuery(CURRENCIES_LIST_CONTRACT, search);
}

export async function getCurrencies(
  search: CurrenciesSearchParams,
): Promise<CurrenciesListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.currencies.$get({
        query: createCurrenciesListQuery(search),
      }),
    schema: CurrenciesListResponseSchema,
    context: "Не удалось загрузить валюты",
  });

  return data;
}

export type CurrencyDetails = z.infer<typeof CurrencyDetailsSchema>;

const getCurrencyByIdUncached = async (
  id: string,
): Promise<CurrencyDetails | null> => {
  return readEntityById({
    id,
    resourceName: "валюту",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.currencies[":id"].$get(
        {
          param: { id: validId },
        },
        {
          init: { cache: "no-store" },
        },
      );
    },
    schema: CurrencyDetailsSchema,
  });
};

export const getCurrencyById = cache(getCurrencyByIdUncached);
