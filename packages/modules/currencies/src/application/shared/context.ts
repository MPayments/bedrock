import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  Queryable,
} from "@bedrock/platform/persistence";

import type { CurrenciesRepositoryPort } from "../ports";
import { createCurrenciesCache, type CurrenciesCacheStore } from "./cache";
import { createDrizzleCurrenciesRepository } from "../../infra/drizzle/repos/currencies-repository";

export interface CurrenciesServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface CurrenciesServiceContext {
  repository: CurrenciesRepositoryPort;
  cache: CurrenciesCacheStore;
  log: Logger;
}

export interface CurrenciesQueriesContext {
  repository: Pick<CurrenciesRepositoryPort, "listPrecisionsByCode">;
}

export function createCurrenciesServiceContext(
  deps: CurrenciesServiceDeps,
): CurrenciesServiceContext {
  return {
    repository: createDrizzleCurrenciesRepository({ db: deps.db }),
    cache: createCurrenciesCache(),
    log: deps.logger?.child({ service: "currencies" }) ?? noopLogger,
  };
}

export function createCurrenciesQueriesContext(input: {
  db: Queryable;
}): CurrenciesQueriesContext {
  return {
    repository: createDrizzleCurrenciesRepository({ db: input.db }),
  };
}
