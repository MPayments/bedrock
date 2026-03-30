import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  AgentBonus,
  Deal,
  DealListRow,
  DealWithDetails,
} from "../contracts/dto";
import type { ListDealsQuery } from "../contracts/queries";
import type {
  DealsByDayQuery,
  DealsByDayEntry,
  DealsByStatusEntry,
  DealsStatisticsQuery,
  DealsStatistics,
} from "../contracts/statistics";

export interface GroupedDealsByStatus {
  pending: DealListRow[];
  inProgress: DealListRow[];
  done: DealListRow[];
}

export interface DealReads {
  findById(id: number): Promise<Deal | null>;
  findByIdWithDetails(id: number): Promise<DealWithDetails | null>;
  list(input: ListDealsQuery): Promise<PaginatedList<DealListRow>>;
  listGroupedByStatus(): Promise<GroupedDealsByStatus>;
  getLatestBonusForDeal(dealId: number): Promise<AgentBonus | null>;
  getStatistics(input: DealsStatisticsQuery): Promise<DealsStatistics>;
  getByDay(input: DealsByDayQuery): Promise<DealsByDayEntry[]>;
  getByStatus(): Promise<DealsByStatusEntry[]>;
}
