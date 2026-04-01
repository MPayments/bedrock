import { and, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  dealApprovals,
  dealCalculationLinks,
  dealLegs,
  dealParticipants,
  deals,
  dealStatusHistory,
} from "./schema";
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
      agentId: input.agentId,
      reason: input.reason,
      intakeComment: input.intakeComment,
      comment: input.comment,
      requestedAmountMinor: input.requestedAmountMinor,
      requestedCurrencyId: input.requestedCurrencyId,
    });
  }

  async createDealCalculationLinks(
    input: {
      id: string;
      calculationId: string;
      dealId: string;
      sourceQuoteId?: string | null;
    }[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db.insert(dealCalculationLinks).values(
      input.map((link) => ({
        id: link.id,
        calculationId: link.calculationId,
        dealId: link.dealId,
        sourceQuoteId: link.sourceQuoteId ?? null,
      })),
    ).onConflictDoNothing({
      target: [dealCalculationLinks.dealId, dealCalculationLinks.calculationId],
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

  async setCounterpartyParticipant(input: {
    counterpartyId: string | null;
    dealId: string;
    id?: string;
  }): Promise<void> {
    await this.db
      .delete(dealParticipants)
      .where(
        and(
          eq(dealParticipants.dealId, input.dealId),
          eq(dealParticipants.role, "counterparty"),
        ),
      );

    if (!input.counterpartyId || !input.id) {
      return;
    }

    await this.db.insert(dealParticipants).values({
      id: input.id,
      dealId: input.dealId,
      role: "counterparty",
      customerId: null,
      organizationId: null,
      counterpartyId: input.counterpartyId,
    });
  }

  async updateDealRoot(input: {
    dealId: string;
    agentId?: string | null;
    calculationId?: string | null;
    comment?: string | null;
    intakeComment?: string | null;
    reason?: string | null;
    requestedAmountMinor?: bigint | null;
    requestedCurrencyId?: string | null;
    status?: CreateDealRootInput["status"];
  }): Promise<void> {
    const values: Record<string, unknown> = {};

    if ("agentId" in input) {
      values.agentId = input.agentId ?? null;
    }
    if ("calculationId" in input) {
      values.calculationId = input.calculationId ?? null;
    }
    if ("comment" in input) {
      values.comment = input.comment ?? null;
    }
    if ("intakeComment" in input) {
      values.intakeComment = input.intakeComment ?? null;
    }
    if ("reason" in input) {
      values.reason = input.reason ?? null;
    }
    if ("requestedAmountMinor" in input) {
      values.requestedAmountMinor = input.requestedAmountMinor ?? null;
    }
    if ("requestedCurrencyId" in input) {
      values.requestedCurrencyId = input.requestedCurrencyId ?? null;
    }
    if ("status" in input) {
      values.status = input.status;
    }

    if (Object.keys(values).length === 0) {
      return;
    }

    await this.db.update(deals).set(values).where(eq(deals.id, input.dealId));
  }
}
