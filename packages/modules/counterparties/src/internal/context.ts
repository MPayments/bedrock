import { noopLogger, type Logger } from "@bedrock/platform-observability/logger";
import type { Database } from "@bedrock/platform-persistence";

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
