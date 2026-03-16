import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

import type {
  PartiesCurrenciesPort,
  PartiesDocumentsReadPort,
  PartiesRequisiteProvidersPort,
} from "./external-ports";
import type {
  CounterpartiesCommandRepository,
  CounterpartiesQueryRepository,
} from "../counterparties/ports";
import type {
  CustomersCommandRepository,
  CustomersQueryRepository,
} from "../customers/ports";
import type {
  CounterpartyGroupsCommandRepository,
  CounterpartyGroupsQueryRepository,
} from "../groups/ports";
import type {
  CounterpartyRequisitesCommandRepository,
  CounterpartyRequisitesQueryRepository,
} from "../requisites/ports";

export interface PartiesServiceDeps {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  documents: PartiesDocumentsReadPort;
  currencies?: PartiesCurrenciesPort;
  requisiteProviders?: PartiesRequisiteProvidersPort;
}

export interface PartiesServiceContext {
  db: Database;
  log: Logger;
  now: () => Date;
  documents: PartiesDocumentsReadPort;
  currencies: PartiesCurrenciesPort;
  requisiteProviders: PartiesRequisiteProvidersPort;
  customers: CustomersCommandRepository;
  customerQueries: CustomersQueryRepository;
  counterparties: CounterpartiesCommandRepository;
  counterpartyQueries: CounterpartiesQueryRepository;
  groups: CounterpartyGroupsCommandRepository;
  groupQueries: CounterpartyGroupsQueryRepository;
  requisites: CounterpartyRequisitesCommandRepository;
  requisiteQueries: CounterpartyRequisitesQueryRepository;
}

export function createPartiesServiceContext(input: {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  documents: PartiesDocumentsReadPort;
  currencies: PartiesCurrenciesPort;
  requisiteProviders: PartiesRequisiteProvidersPort;
  customers: CustomersCommandRepository;
  customerQueries: CustomersQueryRepository;
  counterparties: CounterpartiesCommandRepository;
  counterpartyQueries: CounterpartiesQueryRepository;
  groups: CounterpartyGroupsCommandRepository;
  groupQueries: CounterpartyGroupsQueryRepository;
  requisites: CounterpartyRequisitesCommandRepository;
  requisiteQueries: CounterpartyRequisitesQueryRepository;
}): PartiesServiceContext {
  return {
    db: input.db,
    log: input.logger?.child({ service: "parties" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    documents: input.documents,
    currencies: input.currencies,
    requisiteProviders: input.requisiteProviders,
    customers: input.customers,
    customerQueries: input.customerQueries,
    counterparties: input.counterparties,
    counterpartyQueries: input.counterpartyQueries,
    groups: input.groups,
    groupQueries: input.groupQueries,
    requisites: input.requisites,
    requisiteQueries: input.requisiteQueries,
  };
}
