import type { CounterpartyGroup } from "../contracts/counterparty-group.dto";
import type { ListCounterpartyGroupsQuery } from "../contracts/counterparty-group.queries";

export interface CounterpartyGroupReads {
  list(input: ListCounterpartyGroupsQuery): Promise<CounterpartyGroup[]>;
}
