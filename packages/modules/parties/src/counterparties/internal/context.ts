import { noopLogger, type Logger } from "@bedrock/kernel/logger";
import type { Database } from "@bedrock/kernel/db/types";

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
