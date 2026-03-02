import type { Database } from "@bedrock/foundation/db-types";
import { type Logger, noopLogger } from "@bedrock/foundation/kernel";

export interface OperationalAccountsServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface OperationalAccountsServiceContext {
  db: Database;
  log: Logger;
}

export function createOperationalAccountsServiceContext(
  deps: OperationalAccountsServiceDeps,
): OperationalAccountsServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "operational-accounts" }) ?? noopLogger,
  };
}
