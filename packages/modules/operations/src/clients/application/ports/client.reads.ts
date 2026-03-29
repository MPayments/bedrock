import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Client } from "../contracts/dto";
import type { ListClientsQuery } from "../contracts/queries";

export interface ClientReads {
  findById(id: number): Promise<Client | null>;
  findActiveByCounterpartyId(counterpartyId: string): Promise<Client | null>;
  list(input: ListClientsQuery): Promise<PaginatedList<Client>>;
  listActiveByCounterpartyIds(counterpartyIds: string[]): Promise<Client[]>;
}
