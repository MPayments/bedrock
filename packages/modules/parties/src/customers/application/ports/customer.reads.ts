import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Customer } from "../contracts/dto";
import type { ListCustomersQuery } from "../contracts/queries";

export interface CustomerReads {
  findById(id: string): Promise<Customer | null>;
  findByExternalRef(externalRef: string): Promise<Customer | null>;
  list(input: ListCustomersQuery): Promise<PaginatedList<Customer>>;
  listByIds(ids: string[]): Promise<Customer[]>;
  listDisplayNamesById(ids: string[]): Promise<Map<string, string>>;
}
