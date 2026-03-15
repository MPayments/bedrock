import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  RequisitesCurrenciesPort,
  RequisitesLedgerBindingsPort,
  RequisitesOwnersPort,
  RequisitesRepository,
} from "../ports";

export interface RequisitesServiceDeps {
  db: Database;
  logger?: Logger;
  owners?: RequisitesOwnersPort;
  currencies?: RequisitesCurrenciesPort;
  ledgerBindings?: RequisitesLedgerBindingsPort;
}

export interface RequisitesServiceContext {
  db: Database;
  log: Logger;
  owners: RequisitesOwnersPort;
  currencies: RequisitesCurrenciesPort;
  ledgerBindings: RequisitesLedgerBindingsPort;
  requisites: RequisitesRepository;
}

export function createRequisitesServiceContext(input: {
  db: Database;
  logger?: Logger;
  owners: RequisitesOwnersPort;
  currencies: RequisitesCurrenciesPort;
  ledgerBindings: RequisitesLedgerBindingsPort;
  requisites: RequisitesRepository;
}): RequisitesServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "requisites" }) ?? noopLogger,
    owners: input.owners,
    currencies: input.currencies,
    ledgerBindings: input.ledgerBindings,
    requisites: input.requisites,
  };
}
