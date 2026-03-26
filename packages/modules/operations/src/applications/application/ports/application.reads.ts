import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Application } from "../contracts/dto";
import type { ListApplicationsQuery } from "../contracts/queries";
import type {
  ApplicationsByDayQuery,
  ApplicationsByDayEntry,
  ApplicationsStatisticsQuery,
  ApplicationsStatistics,
} from "../contracts/statistics";

export interface ApplicationReads {
  findById(id: number): Promise<Application | null>;
  list(input: ListApplicationsQuery): Promise<PaginatedList<Application>>;
  countByClientId(clientId: number): Promise<number>;
  listUnassigned(input: {
    limit: number;
    offset: number;
    excludeClientIds?: number[];
  }): Promise<PaginatedList<Application>>;
  getStatistics(
    input: ApplicationsStatisticsQuery,
  ): Promise<ApplicationsStatistics>;
  getByDay(
    input: ApplicationsByDayQuery,
  ): Promise<ApplicationsByDayEntry[]>;
}
