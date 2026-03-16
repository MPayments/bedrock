import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  Transaction,
} from "@bedrock/platform/persistence";

import { createCurrenciesCache, type CurrenciesCacheStore } from "./cache";
import {
  createDrizzleCurrenciesCommandRepository,
  createDrizzleCurrenciesQueryRepository,
} from "../../infra/drizzle/repos/currencies-repository";
import type {
  CurrenciesCommandRepository,
  CurrenciesQueryRepository,
} from "../currencies/ports";

export interface CurrenciesServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface CurrenciesServiceContext {
  commands: CurrenciesCommandRepository;
  queries: CurrenciesQueryRepository;
  cache: CurrenciesCacheStore;
  log: Logger;
}

export interface CurrenciesQueriesContext {
  queries: Pick<CurrenciesQueryRepository, "listPrecisionsByCode">;
}

export function createCurrenciesServiceContext(
  deps: CurrenciesServiceDeps,
): CurrenciesServiceContext {
  return {
    commands: createDrizzleCurrenciesCommandRepository({ db: deps.db }),
    queries: createDrizzleCurrenciesQueryRepository({ db: deps.db }),
    cache: createCurrenciesCache(),
    log: deps.logger?.child({ service: "currencies" }) ?? noopLogger,
  };
}

export function createCurrenciesQueriesContext(input: {
  db: Database | Transaction;
}): CurrenciesQueriesContext {
  return {
    queries: createDrizzleCurrenciesQueryRepository({ db: input.db }),
  };
}
