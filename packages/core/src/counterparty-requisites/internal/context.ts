import { type Logger, noopLogger } from "@bedrock/kernel";
import type { Database } from "@bedrock/kernel/db/types";

export interface CounterpartyRequisitesServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface CounterpartyRequisitesServiceContext {
  db: Database;
  log: Logger;
}

export function createCounterpartyRequisitesServiceContext(
  deps: CounterpartyRequisitesServiceDeps,
): CounterpartyRequisitesServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "counterparty-requisites" }) ?? noopLogger,
  };
}
