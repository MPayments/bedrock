import type { ApplicationStatus } from "../../domain/application-status";
import type { Application } from "../contracts/dto";

export interface ApplicationStore {
  findById(id: number): Promise<Application | null>;
  create(input: {
    agentId: string | null;
    clientId: number;
    counterpartyId: string | null;
    status: ApplicationStatus;
    requestedAmount?: string;
    requestedCurrency?: string;
  }): Promise<Application>;
  updateStatus(
    id: number,
    status: ApplicationStatus,
    reason?: string,
  ): Promise<Application | null>;
  updateComment(id: number, comment: string): Promise<Application | null>;
  assignAgent(id: number, agentId: string): Promise<Application | null>;
  remove(id: number): Promise<boolean>;
}
