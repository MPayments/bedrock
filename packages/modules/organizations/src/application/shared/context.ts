import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  OrganizationsCurrenciesPort,
  OrganizationsLedgerBindingsPort,
  OrganizationsLedgerBooksPort,
  OrganizationsRequisiteProvidersPort,
} from "./external-ports";
import type {
  OrganizationsCommandRepository,
  OrganizationsQueryRepository,
} from "../organizations/ports";
import type {
  OrganizationRequisitesCommandRepository,
  OrganizationRequisitesQueryRepository,
} from "../requisites/ports";

export interface OrganizationsServiceDeps {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  ledgerBooks: OrganizationsLedgerBooksPort;
  currencies?: OrganizationsCurrenciesPort;
  ledgerBindings?: OrganizationsLedgerBindingsPort;
  requisiteProviders?: OrganizationsRequisiteProvidersPort;
}

export interface OrganizationsServiceContext {
  db: Database;
  log: Logger;
  now: () => Date;
  ledgerBooks: OrganizationsLedgerBooksPort;
  currencies: OrganizationsCurrenciesPort;
  ledgerBindings: OrganizationsLedgerBindingsPort;
  requisiteProviders: OrganizationsRequisiteProvidersPort;
  organizations: OrganizationsCommandRepository;
  organizationQueries: OrganizationsQueryRepository;
  requisites: OrganizationRequisitesCommandRepository;
  requisiteQueries: OrganizationRequisitesQueryRepository;
}

export function createOrganizationsServiceContext(input: {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  ledgerBooks: OrganizationsLedgerBooksPort;
  currencies: OrganizationsCurrenciesPort;
  ledgerBindings: OrganizationsLedgerBindingsPort;
  requisiteProviders: OrganizationsRequisiteProvidersPort;
  organizations: OrganizationsCommandRepository;
  organizationQueries: OrganizationsQueryRepository;
  requisites: OrganizationRequisitesCommandRepository;
  requisiteQueries: OrganizationRequisitesQueryRepository;
}): OrganizationsServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "organizations" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    ledgerBooks: input.ledgerBooks,
    currencies: input.currencies,
    ledgerBindings: input.ledgerBindings,
    requisiteProviders: input.requisiteProviders,
    organizations: input.organizations,
    organizationQueries: input.organizationQueries,
    requisites: input.requisites,
    requisiteQueries: input.requisiteQueries,
  };
}
