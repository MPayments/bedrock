import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Agreement,
  AgreementDetails,
} from "../contracts/dto";
import type { ListAgreementsQuery } from "../contracts/queries";

export interface AgreementReads {
  findById(id: string): Promise<AgreementDetails | null>;
  list(input: ListAgreementsQuery): Promise<PaginatedList<Agreement>>;
}
