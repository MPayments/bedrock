import type { Database } from "@bedrock/foundation/db/types";
import { type Logger, noopLogger } from "@bedrock/foundation/kernel";

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
