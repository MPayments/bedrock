import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type { CurrenciesCacheStore } from "./cache";
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

export function createCurrenciesServiceContext(input: {
  commands: CurrenciesCommandRepository;
  queries: CurrenciesQueryRepository;
  cache: CurrenciesCacheStore;
  logger?: Logger;
}): CurrenciesServiceContext {
  return {
    commands: input.commands,
    queries: input.queries,
    cache: input.cache,
    log: input.logger?.child({ service: "currencies" }) ?? noopLogger,
  };
}

export function createCurrenciesQueriesContext(input: {
  queries: Pick<CurrenciesQueryRepository, "listPrecisionsByCode">;
}): CurrenciesQueriesContext {
  return {
    queries: input.queries,
  };
}
