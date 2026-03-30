import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { SubAgentProfile } from "../contracts/dto";
import type { ListSubAgentProfilesQuery } from "../contracts/queries";

export interface SubAgentProfileReads {
  findById(counterpartyId: string): Promise<SubAgentProfile | null>;
  list(input: ListSubAgentProfilesQuery): Promise<PaginatedList<SubAgentProfile>>;
}
