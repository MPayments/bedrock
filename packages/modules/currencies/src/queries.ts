import type { Database, Transaction } from "@bedrock/platform/persistence";

import { createListCurrencyPrecisionsByCodeHandler } from "./application/queries";
import { createCurrenciesQueriesContext } from "./application/shared/context";
import { createDrizzleCurrenciesQueryRepository } from "./infra/drizzle/repos/currencies-repository";

export interface CurrenciesQueries {
  listPrecisionsByCode: (codes: string[]) => Promise<Map<string, number>>;
}

export function createCurrenciesQueries(input: {
  db: Database | Transaction;
}): CurrenciesQueries {
  const context = createCurrenciesQueriesContext({
    queries: createDrizzleCurrenciesQueryRepository({ db: input.db }),
  });

  const listPrecisionsByCode =
    createListCurrencyPrecisionsByCodeHandler(context);

  return {
    listPrecisionsByCode,
  };
}
