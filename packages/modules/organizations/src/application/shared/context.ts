import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  OrganizationsCurrenciesPort,
  OrganizationsLedgerBooksPort,
  OrganizationsLedgerBindingsPort,
  OrganizationsRepository,
  OrganizationsRequisiteProvidersPort,
  OrganizationRequisitesRepository,
} from "../ports";

export interface OrganizationsServiceDeps {
  db: Database;
  logger?: Logger;
  ledgerBooks: OrganizationsLedgerBooksPort;
  currencies?: OrganizationsCurrenciesPort;
  ledgerBindings?: OrganizationsLedgerBindingsPort;
  requisiteProviders?: OrganizationsRequisiteProvidersPort;
}

export interface OrganizationsServiceContext {
  db: Database;
  log: Logger;
  ledgerBooks: OrganizationsLedgerBooksPort;
  currencies: OrganizationsCurrenciesPort;
  ledgerBindings: OrganizationsLedgerBindingsPort;
  requisiteProviders: OrganizationsRequisiteProvidersPort;
  organizations: OrganizationsRepository;
  requisites: OrganizationRequisitesRepository;
}

export function createOrganizationsServiceContext(input: {
  db: Database;
  logger?: Logger;
  ledgerBooks: OrganizationsLedgerBooksPort;
  currencies: OrganizationsCurrenciesPort;
  ledgerBindings: OrganizationsLedgerBindingsPort;
  requisiteProviders: OrganizationsRequisiteProvidersPort;
  organizations: OrganizationsRepository;
  requisites: OrganizationRequisitesRepository;
}): OrganizationsServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "organizations" }) ?? noopLogger,
    ledgerBooks: input.ledgerBooks,
    currencies: input.currencies,
    ledgerBindings: input.ledgerBindings,
    requisiteProviders: input.requisiteProviders,
    organizations: input.organizations,
    requisites: input.requisites,
  };
}
