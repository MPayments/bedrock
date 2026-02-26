import type { Database } from "@bedrock/db";
import type { Logger } from "@bedrock/kernel";
import { noopLogger } from "@bedrock/kernel";

export interface AccountingServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface AccountingServiceContext {
  db: Database;
  log: Logger;
}

export function createAccountingServiceContext(
  deps: AccountingServiceDeps,
): AccountingServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "accounting" }) ?? noopLogger,
  };
}
