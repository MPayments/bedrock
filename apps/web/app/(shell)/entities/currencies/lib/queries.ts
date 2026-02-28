import { cache } from "react";

import {
  CURRENCIES_LIST_CONTRACT,
  CurrencySchema,
} from "@bedrock/currencies/contracts";

import { getServerApiClient } from "@/lib/api-client.server";
import { readResourceById } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { CurrenciesListResult } from "../(table)";
import { type CurrenciesSearchParams } from "./validations";

function createCurrenciesListQuery(search: CurrenciesSearchParams) {
  return createResourceListQuery(CURRENCIES_LIST_CONTRACT, search);
}

export async function getCurrencies(
  search: CurrenciesSearchParams,
): Promise<CurrenciesListResult> {
  const client = await getServerApiClient();
  const res = await client.v1.currencies.$get({
    query: createCurrenciesListQuery(search),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch currencies: ${res.status}`);
  }

  const payload = (await res.json()) as {
    data: unknown[];
    limit: number;
    offset: number;
    total: number;
  };

  return {
    ...payload,
    data: payload.data.map((currency: unknown) => CurrencySchema.parse(currency)),
  };
}

export interface CurrencyDetails {
  id: string;
  name: string;
  code: string;
  symbol: string;
  precision: number;
  createdAt: string;
  updatedAt: string;
}

const getCurrencyByIdUncached = async (
  id: string,
): Promise<CurrencyDetails | null> => {
  return readResourceById<CurrencyDetails>({
    id,
    resourceName: "currency",
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
  });
};

export const getCurrencyById = cache(getCurrencyByIdUncached);
