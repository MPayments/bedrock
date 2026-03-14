import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  OrganizationsLedgerBooksPort,
  OrganizationsRepository,
} from "../ports";

export interface OrganizationsServiceDeps {
  db: Database;
  logger?: Logger;
  ledgerBooks: OrganizationsLedgerBooksPort;
}

export interface OrganizationsServiceContext {
  db: Database;
  log: Logger;
  ledgerBooks: OrganizationsLedgerBooksPort;
  organizations: OrganizationsRepository;
}

export function createOrganizationsServiceContext(input: {
  db: Database;
  logger?: Logger;
  ledgerBooks: OrganizationsLedgerBooksPort;
  organizations: OrganizationsRepository;
}): OrganizationsServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "organizations" }) ?? noopLogger,
    ledgerBooks: input.ledgerBooks,
    organizations: input.organizations,
  };
}
