import type { Database } from "@bedrock/kernel/db/types";
import { type Logger, noopLogger } from "@bedrock/kernel";

export interface RequisitesServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface RequisitesServiceContext {
  db: Database;
  log: Logger;
}

export function createRequisitesServiceContext(
  deps: RequisitesServiceDeps,
): RequisitesServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "requisites" }) ?? noopLogger,
  };
}
