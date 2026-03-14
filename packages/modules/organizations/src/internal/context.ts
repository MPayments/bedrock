import { noopLogger, type Logger } from "@bedrock/platform-observability/logger";
import type { Database } from "@bedrock/platform-persistence";

export interface OrganizationsServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface OrganizationsServiceContext {
  db: Database;
  log: Logger;
}

export function createOrganizationsServiceContext(
  deps: OrganizationsServiceDeps,
): OrganizationsServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "organizations" }) ?? noopLogger,
  };
}
