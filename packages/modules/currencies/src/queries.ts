import type { Database, Transaction } from "@bedrock/platform/persistence";

import {
  ListCurrenciesByIdsQuery,
  ListCurrencyPrecisionsByCodeQuery,
} from "./application/queries";
import { createCurrenciesQueriesContext } from "./application/shared/context";
import type { Currency } from "./contracts";
import { createDrizzleCurrenciesQueryRepository } from "./infra/drizzle/repos/currencies-repository";

export interface CurrenciesQueries {
  listByIds: (ids: string[]) => Promise<Map<string, Currency>>;
  listPrecisionsByCode: (codes: string[]) => Promise<Map<string, number>>;
}

export function createCurrenciesQueries(input: {
  db: Database | Transaction;
}): CurrenciesQueries {
  const context = createCurrenciesQueriesContext({
    queries: createDrizzleCurrenciesQueryRepository({ db: input.db }),
  });

  const listCurrencyPrecisionsByCode = new ListCurrencyPrecisionsByCodeQuery(
    context,
  );
  const listCurrenciesByIds = new ListCurrenciesByIdsQuery(context);

  return {
    listByIds: listCurrenciesByIds.execute.bind(listCurrenciesByIds),
    listPrecisionsByCode:
      listCurrencyPrecisionsByCode.execute.bind(listCurrencyPrecisionsByCode),
  };
}
