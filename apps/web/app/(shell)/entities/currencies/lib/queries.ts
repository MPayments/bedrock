import { CURRENCIES_LIST_CONTRACT } from "@bedrock/currencies";

import { apiClient } from "@/lib/api-client";
import { createListQueryFromSearchParams } from "@/lib/list-search-params";

import type { CurrenciesListResult } from "../(table)";
import { type CurrenciesSearchParams } from "./validations";

export function createCurrenciesListQuery(search: CurrenciesSearchParams) {
  return createListQueryFromSearchParams(CURRENCIES_LIST_CONTRACT, search);
}

export async function getCurrencies(
  search: CurrenciesSearchParams,
): Promise<CurrenciesListResult> {
  const res = await apiClient.v1.currencies.$get(
    {
      query: createCurrenciesListQuery(search),
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch currencies: ${res.status}`);
  }

  return res.json() as Promise<CurrenciesListResult>;
}
