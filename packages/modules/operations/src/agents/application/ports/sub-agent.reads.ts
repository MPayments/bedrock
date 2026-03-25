import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { SubAgent } from "../contracts/sub-agent-dto";
import type { ListSubAgentsQuery } from "../contracts/sub-agent-queries";

export interface SubAgentReads {
  findById(id: number): Promise<SubAgent | null>;
  list(input: ListSubAgentsQuery): Promise<PaginatedList<SubAgent>>;
}
