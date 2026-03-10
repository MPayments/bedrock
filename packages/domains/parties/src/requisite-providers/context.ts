import { type Logger, noopLogger } from "@bedrock/common";
import type { Database } from "@bedrock/common/sql/ports";

export interface RequisiteProvidersServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface RequisiteProvidersServiceContext {
  db: Database;
  log: Logger;
}

export function createRequisiteProvidersServiceContext(
  deps: RequisiteProvidersServiceDeps,
): RequisiteProvidersServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "requisite-providers" }) ?? noopLogger,
  };
}
