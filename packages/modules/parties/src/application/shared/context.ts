import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  CounterpartyRequisitesRepository,
  PartiesCurrenciesPort,
  PartiesDocumentsReadPort,
  PartiesRepository,
  PartiesRequisiteProvidersPort,
} from "../ports";

export interface PartiesServiceDeps {
  db: Database;
  logger?: Logger;
  documents: PartiesDocumentsReadPort;
  currencies?: PartiesCurrenciesPort;
  requisiteProviders?: PartiesRequisiteProvidersPort;
}

export interface PartiesServiceContext {
  db: Database;
  log: Logger;
  documents: PartiesDocumentsReadPort;
  currencies: PartiesCurrenciesPort;
  requisiteProviders: PartiesRequisiteProvidersPort;
  parties: PartiesRepository;
  requisites: CounterpartyRequisitesRepository;
}

export function createPartiesServiceContext(input: {
  db: Database;
  logger?: Logger;
  documents: PartiesDocumentsReadPort;
  currencies: PartiesCurrenciesPort;
  requisiteProviders: PartiesRequisiteProvidersPort;
  parties: PartiesRepository;
  requisites: CounterpartyRequisitesRepository;
}): PartiesServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "parties" }) ?? noopLogger,
    documents: input.documents,
    currencies: input.currencies,
    requisiteProviders: input.requisiteProviders,
    parties: input.parties,
    requisites: input.requisites,
  };
}
