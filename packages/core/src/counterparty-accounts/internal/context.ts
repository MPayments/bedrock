import type { Database } from "@bedrock/kernel/db/types";
import { type Logger, noopLogger } from "@bedrock/kernel";

export interface CounterpartyAccountsServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface CounterpartyAccountsServiceContext {
  db: Database;
  log: Logger;
}

export function createCounterpartyAccountsServiceContext(
  deps: CounterpartyAccountsServiceDeps,
): CounterpartyAccountsServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "counterparty-accounts" }) ?? noopLogger,
  };
}
