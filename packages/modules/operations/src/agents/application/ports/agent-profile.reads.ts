import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { AgentProfile } from "../contracts/dto";
import type { ListAgentsQuery } from "../contracts/queries";

export interface AgentProfileReads {
  findById(id: number): Promise<AgentProfile | null>;
  findByTgId(tgId: number): Promise<AgentProfile | null>;
  findByEmail(email: string): Promise<AgentProfile | null>;
  list(input: ListAgentsQuery): Promise<PaginatedList<AgentProfile>>;
  listAllowed(): Promise<AgentProfile[]>;
}
