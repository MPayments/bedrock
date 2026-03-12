import type { Database } from "@bedrock/kernel/db/types";
import { type Logger, noopLogger } from "@bedrock/kernel";

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
