import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

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
