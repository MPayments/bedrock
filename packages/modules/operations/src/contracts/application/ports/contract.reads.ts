import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Contract } from "../contracts/dto";
import type { ListContractsQuery } from "../contracts/queries";

export interface ContractReads {
  findById(id: number): Promise<Contract | null>;
  findByClientId(clientId: number): Promise<Contract | null>;
  list(input: ListContractsQuery): Promise<PaginatedList<Contract>>;
}
