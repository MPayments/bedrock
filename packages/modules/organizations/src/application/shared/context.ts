import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";

import type {
  OrganizationsRequisiteSubjectsPort,
  OrganizationsTransactionsPort,
} from "./external-ports";
import type { OrganizationsQueryRepository } from "../organizations/ports";
import type {
  OrganizationRequisiteBindingsQueryRepository,
} from "../requisites/ports";

export interface OrganizationsServiceContext {
  log: Logger;
  now: () => Date;
  organizationQueries: OrganizationsQueryRepository;
  requisiteSubjects: OrganizationsRequisiteSubjectsPort;
  requisiteBindingQueries: OrganizationRequisiteBindingsQueryRepository;
  transactions: OrganizationsTransactionsPort;
}

export function createOrganizationsServiceContext(input: {
  logger?: Logger;
  now?: () => Date;
  organizationQueries: OrganizationsQueryRepository;
  requisiteSubjects: OrganizationsRequisiteSubjectsPort;
  requisiteBindingQueries: OrganizationRequisiteBindingsQueryRepository;
  transactions: OrganizationsTransactionsPort;
}): OrganizationsServiceContext {
  return {
    log: input.logger?.child({ service: "organizations" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    organizationQueries: input.organizationQueries,
    requisiteSubjects: input.requisiteSubjects,
    requisiteBindingQueries: input.requisiteBindingQueries,
    transactions: input.transactions,
  };
}
