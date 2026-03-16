import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";

import type { PartiesTransactionsPort } from "./external-ports";
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

export interface PartiesServiceContext {
  log: Logger;
  now: () => Date;
  customerQueries: CustomersQueryRepository;
  counterparties: CounterpartiesMutationRepository;
  counterpartyQueries: CounterpartiesQueryRepository;
  groups: CounterpartyGroupsMutableRepository;
  groupQueries: CounterpartyGroupsQueryRepository;
  transactions: PartiesTransactionsPort;
}

export function createPartiesServiceContext(input: {
  logger?: Logger;
  now?: () => Date;
  customerQueries: CustomersQueryRepository;
  counterparties: CounterpartiesMutationRepository;
  counterpartyQueries: CounterpartiesQueryRepository;
  groups: CounterpartyGroupsMutableRepository;
  groupQueries: CounterpartyGroupsQueryRepository;
  transactions: PartiesTransactionsPort;
}): PartiesServiceContext {
  return {
    log: input.logger?.child({ service: "parties" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    customerQueries: input.customerQueries,
    counterparties: input.counterparties,
    counterpartyQueries: input.counterpartyQueries,
    groups: input.groups,
    groupQueries: input.groupQueries,
    transactions: input.transactions,
  };
}
