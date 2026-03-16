import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";

import type { OrganizationsTransactionsPort } from "./external-ports";
import type { OrganizationsQueryRepository } from "../organizations/ports";

export interface OrganizationsServiceContext {
  log: Logger;
  now: () => Date;
  organizationQueries: OrganizationsQueryRepository;
  transactions: OrganizationsTransactionsPort;
}

export function createOrganizationsServiceContext(input: {
  logger?: Logger;
  now?: () => Date;
  organizationQueries: OrganizationsQueryRepository;
  transactions: OrganizationsTransactionsPort;
}): OrganizationsServiceContext {
  return {
    log: input.logger?.child({ service: "organizations" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    organizationQueries: input.organizationQueries,
    transactions: input.transactions,
  };
}
