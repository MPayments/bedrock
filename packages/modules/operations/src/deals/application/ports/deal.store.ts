import type { SetAgentBonusInput } from "../contracts/commands";
import type { AgentBonus, Deal } from "../contracts/dto";

export interface DealStore {
  findById(id: number): Promise<Deal | null>;
  insertAgentBonus(input: SetAgentBonusInput): Promise<AgentBonus>;
}
