import { type Logger, noopLogger } from "@multihansa/common";
import type { Database } from "@multihansa/common/sql/ports";

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
