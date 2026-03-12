import { type Logger, noopLogger } from "@bedrock/common";
import type { Database } from "@bedrock/sql/ports";

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
