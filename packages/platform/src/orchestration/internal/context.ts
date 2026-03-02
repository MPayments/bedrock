import type { Database } from "@bedrock/db/types";
import { noopLogger, type Logger } from "@bedrock/foundation/kernel";

export interface OrchestrationServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface OrchestrationServiceContext {
  db: Database;
  log: Logger;
}

export function createOrchestrationServiceContext(
  deps: OrchestrationServiceDeps,
): OrchestrationServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ svc: "orchestration" }) ?? noopLogger,
  };
}
