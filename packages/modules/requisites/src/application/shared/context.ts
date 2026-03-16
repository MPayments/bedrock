import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  RequisitesCommandRepository,
  RequisitesQueryRepository,
} from "../requisites/ports";
import type {
  RequisiteProvidersCommandRepository,
  RequisiteProvidersQueryRepository,
} from "../providers/ports";
import type {
  RequisitesCurrenciesPort,
  RequisitesOrganizationBindingsPort,
  RequisitesOwnersPort,
} from "./external-ports";

export interface RequisitesServiceDeps {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  currencies: RequisitesCurrenciesPort;
  owners: RequisitesOwnersPort;
  organizationBindings: RequisitesOrganizationBindingsPort;
}

export interface RequisitesServiceContext {
  db: Database;
  log: Logger;
  now: () => Date;
  currencies: RequisitesCurrenciesPort;
  owners: RequisitesOwnersPort;
  organizationBindings: RequisitesOrganizationBindingsPort;
  requisiteQueries: RequisitesQueryRepository;
  requisiteCommands: RequisitesCommandRepository;
  providerQueries: RequisiteProvidersQueryRepository;
  providerCommands: RequisiteProvidersCommandRepository;
}

export function createRequisitesServiceContext(input: {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  currencies: RequisitesCurrenciesPort;
  owners: RequisitesOwnersPort;
  organizationBindings: RequisitesOrganizationBindingsPort;
  requisiteQueries: RequisitesQueryRepository;
  requisiteCommands: RequisitesCommandRepository;
  providerQueries: RequisiteProvidersQueryRepository;
  providerCommands: RequisiteProvidersCommandRepository;
}): RequisitesServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "requisites" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    currencies: input.currencies,
    owners: input.owners,
    organizationBindings: input.organizationBindings,
    requisiteQueries: input.requisiteQueries,
    requisiteCommands: input.requisiteCommands,
    providerQueries: input.providerQueries,
    providerCommands: input.providerCommands,
  };
}
