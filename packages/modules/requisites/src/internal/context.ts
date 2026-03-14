import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

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
