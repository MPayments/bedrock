import { type Logger, noopLogger } from "@multihansa/common";
import type { Database } from "@multihansa/common/sql/ports";

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
