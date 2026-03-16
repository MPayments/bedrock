import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";

import type {
  OrganizationsCurrenciesPort,
  OrganizationsRequisiteProvidersPort,
  OrganizationsTransactionsPort,
} from "./external-ports";
import type { OrganizationsQueryRepository } from "../organizations/ports";
import type {
  OrganizationRequisitesQueryRepository,
} from "../requisites/ports";

export interface OrganizationsServiceContext {
  log: Logger;
  now: () => Date;
  currencies: OrganizationsCurrenciesPort;
  requisiteProviders: OrganizationsRequisiteProvidersPort;
  organizationQueries: OrganizationsQueryRepository;
  requisiteQueries: OrganizationRequisitesQueryRepository;
  transactions: OrganizationsTransactionsPort;
}

export function createOrganizationsServiceContext(input: {
  logger?: Logger;
  now?: () => Date;
  currencies: OrganizationsCurrenciesPort;
  requisiteProviders: OrganizationsRequisiteProvidersPort;
  organizationQueries: OrganizationsQueryRepository;
  requisiteQueries: OrganizationRequisitesQueryRepository;
  transactions: OrganizationsTransactionsPort;
}): OrganizationsServiceContext {
  return {
    log: input.logger?.child({ service: "organizations" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    currencies: input.currencies,
    requisiteProviders: input.requisiteProviders,
    organizationQueries: input.organizationQueries,
    requisiteQueries: input.requisiteQueries,
    transactions: input.transactions,
  };
}
