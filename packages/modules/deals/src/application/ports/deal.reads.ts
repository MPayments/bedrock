import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Deal,
  DealCalculationHistoryItem,
  DealDetails,
} from "../contracts/dto";
import type { ListDealsQuery } from "../contracts/queries";

export interface DealReads {
  findById(id: string): Promise<DealDetails | null>;
  list(input: ListDealsQuery): Promise<PaginatedList<Deal>>;
  listCalculationHistory(dealId: string): Promise<DealCalculationHistoryItem[]>;
}
