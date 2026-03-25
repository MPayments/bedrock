import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { BankDetails } from "../contracts/bank-details-dto";
import type { ListBankDetailsQuery } from "../contracts/bank-details-queries";

export interface BankDetailsReads {
  findById(id: number): Promise<BankDetails | null>;
  listByOrganizationId(organizationId: number): Promise<BankDetails[]>;
  list(input: ListBankDetailsQuery): Promise<PaginatedList<BankDetails>>;
}
