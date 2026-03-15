import type {
  Database,
  Transaction,
} from "@bedrock/platform/persistence";

import { createListCurrencyPrecisionsByCodeHandler } from "./application/queries";
import { createCurrenciesQueriesContext } from "./application/shared/context";

export interface CurrenciesQueries {
  listPrecisionsByCode: (codes: string[]) => Promise<Map<string, number>>;
}

export function createCurrenciesQueries(input: {
  db: Database | Transaction;
}): CurrenciesQueries {
  const context = createCurrenciesQueriesContext(input);

  const listPrecisionsByCode = createListCurrencyPrecisionsByCodeHandler(
    context,
  );

  return {
    listPrecisionsByCode,
  };
}
