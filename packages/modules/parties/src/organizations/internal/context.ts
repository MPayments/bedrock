import { noopLogger, type Logger } from "@bedrock/kernel/logger";
import type { Database } from "@bedrock/kernel/db/types";

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
