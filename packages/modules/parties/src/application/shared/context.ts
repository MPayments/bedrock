import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";

import type {
  PartiesCurrenciesPort,
  PartiesRequisiteProvidersPort,
  PartiesTransactionsPort,
} from "./external-ports";
import type {
  CounterpartiesMutationRepository,
  CounterpartiesQueryRepository,
} from "../counterparties/ports";
import type {
  CustomersQueryRepository,
} from "../customers/ports";
import type {
  CounterpartyGroupsMutableRepository,
  CounterpartyGroupsQueryRepository,
} from "../groups/ports";
import type {
  CounterpartyRequisitesQueryRepository,
} from "../requisites/ports";

export interface PartiesServiceContext {
  log: Logger;
  now: () => Date;
  currencies: PartiesCurrenciesPort;
  requisiteProviders: PartiesRequisiteProvidersPort;
  customerQueries: CustomersQueryRepository;
  counterparties: CounterpartiesMutationRepository;
  counterpartyQueries: CounterpartiesQueryRepository;
  groups: CounterpartyGroupsMutableRepository;
  groupQueries: CounterpartyGroupsQueryRepository;
  requisiteQueries: CounterpartyRequisitesQueryRepository;
  transactions: PartiesTransactionsPort;
}

export function createPartiesServiceContext(input: {
  logger?: Logger;
  now?: () => Date;
  currencies: PartiesCurrenciesPort;
  requisiteProviders: PartiesRequisiteProvidersPort;
  customerQueries: CustomersQueryRepository;
  counterparties: CounterpartiesMutationRepository;
  counterpartyQueries: CounterpartiesQueryRepository;
  groups: CounterpartyGroupsMutableRepository;
  groupQueries: CounterpartyGroupsQueryRepository;
  requisiteQueries: CounterpartyRequisitesQueryRepository;
  transactions: PartiesTransactionsPort;
}): PartiesServiceContext {
  return {
    log: input.logger?.child({ service: "parties" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    currencies: input.currencies,
    requisiteProviders: input.requisiteProviders,
    customerQueries: input.customerQueries,
    counterparties: input.counterparties,
    counterpartyQueries: input.counterpartyQueries,
    groups: input.groups,
    groupQueries: input.groupQueries,
    requisiteQueries: input.requisiteQueries,
    transactions: input.transactions,
  };
}
