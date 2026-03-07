import { type Logger, noopLogger } from "@bedrock/kernel";
import type { Database } from "@bedrock/kernel/db/types";

export interface OrganizationRequisitesServiceDeps {
  db: Database;
  logger?: Logger;
}

export interface OrganizationRequisitesServiceContext {
  db: Database;
  log: Logger;
}

export function createOrganizationRequisitesServiceContext(
  deps: OrganizationRequisitesServiceDeps,
): OrganizationRequisitesServiceContext {
  return {
    db: deps.db,
    log: deps.logger?.child({ service: "organization-requisites" }) ?? noopLogger,
  };
}
