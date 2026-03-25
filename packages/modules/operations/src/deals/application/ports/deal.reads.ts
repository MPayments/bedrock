import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { AgentBonus, Deal, DealDocument, DealWithDetails } from "../contracts/dto";
import type { ListDealsQuery } from "../contracts/queries";

export interface DealReads {
  findById(id: number): Promise<Deal | null>;
  findByIdWithDetails(id: number): Promise<DealWithDetails | null>;
  list(input: ListDealsQuery): Promise<PaginatedList<Deal>>;
  listDocuments(dealId: number): Promise<DealDocument[]>;
  getLatestBonusForDeal(dealId: number): Promise<AgentBonus | null>;
}
