import { cache } from "react";
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

export interface CurrencyDetails {
  id: string;
  name: string;
  code: string;
  symbol: string;
  precision: number;
  createdAt: string;
  updatedAt: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getCurrencyByIdUncached = async (
  id: string,
): Promise<CurrencyDetails | null> => {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const client = await getServerApiClient();
  const res = await client.v1.currencies[":id"].$get(
    {
      param: { id },
    },
    {
      init: { cache: "no-store" },
    },
  );

  const status = (res as Response).status;
  if (status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch currency: ${status}`);
  }

  const payload = await res.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !("id" in payload) ||
    typeof payload.id !== "string"
  ) {
    return null;
  }

  return payload as CurrencyDetails;
};

export const getCurrencyById = cache(getCurrencyByIdUncached);
