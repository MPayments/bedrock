import { CURRENCIES_LIST_CONTRACT, CurrencySchema } from "@bedrock/currencies";

import { getServerApiClient } from "@/lib/api-client.server";
import { createListQueryFromSearchParams } from "@/lib/list-search-params";

import type { CurrenciesListResult } from "../(table)";
import { type CurrenciesSearchParams } from "./validations";

function createCurrenciesListQuery(search: CurrenciesSearchParams) {
  return createListQueryFromSearchParams(CURRENCIES_LIST_CONTRACT, search);
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

  const payload = await res.json();

  return {
    ...payload,
    data: payload.data.map((currency) => CurrencySchema.parse(currency)),
  };
}
