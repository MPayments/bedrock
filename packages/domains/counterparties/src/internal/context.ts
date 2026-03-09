import { type Logger, noopLogger } from "@bedrock/common";
import type { Database } from "@bedrock/sql/ports";

export interface CounterpartiesServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface CounterpartiesServiceContext {
  db: Database;
  log: Logger;
}

export function createCounterpartiesServiceContext(
  deps: CounterpartiesServiceDeps,
): CounterpartiesServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "counterparties" }) ?? noopLogger,
  };
}
