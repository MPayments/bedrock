import type { DealStatus } from "../../domain/deal-status";
import type { CreateDealInput, SetAgentBonusInput, UpdateDealDetailsInput } from "../contracts/commands";
import type { AgentBonus, Deal } from "../contracts/dto";

export interface DealStore {
  findById(id: number): Promise<Deal | null>;
  findByApplicationId(applicationId: number): Promise<Deal | null>;
  create(input: CreateDealInput): Promise<Deal>;
  updateStatus(id: number, status: DealStatus, closedAt?: string): Promise<Deal | null>;
  updateDetails(input: UpdateDealDetailsInput): Promise<Deal | null>;
  remove(id: number): Promise<boolean>;
  insertAgentBonus(input: SetAgentBonusInput): Promise<AgentBonus>;
}
