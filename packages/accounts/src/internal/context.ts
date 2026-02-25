import { type Database } from "@bedrock/db";
import { type Logger, noopLogger } from "@bedrock/kernel";

export interface AccountServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface AccountServiceContext {
  db: Database;
  log: Logger;
}

export function createAccountServiceContext(
  deps: AccountServiceDeps,
): AccountServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "accounts" }) ?? noopLogger,
  };
}
