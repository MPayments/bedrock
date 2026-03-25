import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { ActivityLogEntry } from "../contracts/dto";
import type { ListActivitiesQuery } from "../contracts/queries";

export interface ActivityLogReads {
  list(input: ListActivitiesQuery): Promise<PaginatedList<ActivityLogEntry>>;
}
