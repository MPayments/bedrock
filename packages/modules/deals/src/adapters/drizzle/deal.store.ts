import { dealApprovals, dealLegs, dealParticipants, deals, dealStatusHistory } from "./schema";
import type { Queryable } from "@bedrock/platform/persistence";
import type {
  CreateDealApprovalStoredInput,
  CreateDealLegStoredInput,
  CreateDealParticipantStoredInput,
  CreateDealRootInput,
  CreateDealStatusHistoryStoredInput,
  DealStore,
} from "../../application/ports/deal.store";

export class DrizzleDealStore implements DealStore {
  constructor(private readonly db: Queryable) {}

  async createDealRoot(input: CreateDealRootInput): Promise<void> {
    await this.db.insert(deals).values({
      id: input.id,
      customerId: input.customerId,
      agreementId: input.agreementId,
      calculationId: input.calculationId,
      type: input.type,
      status: input.status ?? "draft",
      comment: input.comment,
    });
  }

  async createDealLegs(input: CreateDealLegStoredInput[]): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db.insert(dealLegs).values(
      input.map((leg) => ({
        id: leg.id,
        dealId: leg.dealId,
        idx: leg.idx,
        kind: leg.kind,
        status: leg.status,
      })),
    );
  }

  async createDealParticipants(
    input: CreateDealParticipantStoredInput[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db.insert(dealParticipants).values(
      input.map((participant) => ({
        id: participant.id,
        dealId: participant.dealId,
        role: participant.role,
        customerId: participant.customerId,
        organizationId: participant.organizationId,
        counterpartyId: participant.counterpartyId,
      })),
    );
  }

  async createDealStatusHistory(
    input: CreateDealStatusHistoryStoredInput[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db.insert(dealStatusHistory).values(
      input.map((entry) => ({
        id: entry.id,
        dealId: entry.dealId,
        status: entry.status,
        changedBy: entry.changedBy,
        comment: entry.comment,
      })),
    );
  }

  async createDealApprovals(
    input: CreateDealApprovalStoredInput[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db.insert(dealApprovals).values(
      input.map((approval) => ({
        id: approval.id,
        dealId: approval.dealId,
        approvalType: approval.approvalType,
        status: approval.status,
        requestedBy: approval.requestedBy,
        decidedBy: approval.decidedBy,
        comment: approval.comment,
        requestedAt: approval.requestedAt,
        decidedAt: approval.decidedAt,
      })),
    );
  }
}
