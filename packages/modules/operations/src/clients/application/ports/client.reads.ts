import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Client } from "../contracts/dto";
import type { ListClientsQuery } from "../contracts/queries";

export interface ClientReads {
  findById(id: number): Promise<Client | null>;
  findActiveByCustomerId(customerId: string): Promise<Client | null>;
  list(input: ListClientsQuery): Promise<PaginatedList<Client>>;
  listActiveByCustomerIds(customerIds: string[]): Promise<Client[]>;
}
