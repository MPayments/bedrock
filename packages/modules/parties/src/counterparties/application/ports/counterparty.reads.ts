import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Counterparty } from "../contracts/counterparty.dto";
import type { ListCounterpartiesQuery } from "../contracts/counterparty.queries";

export interface CounterpartyReads {
  findById(id: string): Promise<Counterparty | null>;
  list(input: ListCounterpartiesQuery): Promise<PaginatedList<Counterparty>>;
}
