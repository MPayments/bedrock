import { and, eq, isNull } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  dealCapabilityStates,
  dealApprovals,
  dealCalculationLinks,
  dealIntakeSnapshots,
  dealLegs,
  dealOperationalPositions,
  dealParticipants,
  deals,
  dealQuoteAcceptances,
  dealTimelineEvents,
} from "./schema";
import type {
  CreateDealApprovalStoredInput,
  CreateDealIntakeSnapshotStoredInput,
  CreateDealLegStoredInput,
  ReplaceDealOperationalPositionStoredInput,
  CreateDealParticipantStoredInput,
  CreateDealQuoteAcceptanceStoredInput,
  CreateDealRootInput,
  CreateDealTimelineEventStoredInput,
  DealStore,
  UpsertDealCapabilityStateStoredInput,
} from "../../application/ports/deal.store";

export class DrizzleDealStore implements DealStore {
  constructor(private readonly db: Queryable) {}

  async createDealRoot(input: CreateDealRootInput): Promise<void> {
    await this.db.insert(deals).values({
      agreementId: input.agreementId,
      agentId: input.agentId,
      calculationId: input.calculationId,
      customerId: input.customerId,
      id: input.id,
      nextAction: input.nextAction,
      sourceAmountMinor: input.sourceAmountMinor,
      sourceCurrencyId: input.sourceCurrencyId,
      status: input.status ?? "draft",
      targetCurrencyId: input.targetCurrencyId,
      type: input.type,
    });
  }

  async createDealIntakeSnapshot(
    input: CreateDealIntakeSnapshotStoredInput,
  ): Promise<void> {
    await this.db.insert(dealIntakeSnapshots).values({
      dealId: input.dealId,
      revision: input.revision,
      snapshot: input.snapshot,
    });
  }

  async replaceIntakeSnapshot(input: {
    dealId: string;
    expectedRevision: number;
    nextRevision: number;
    snapshot: CreateDealIntakeSnapshotStoredInput["snapshot"];
  }): Promise<boolean> {
    const updated = await this.db
      .update(dealIntakeSnapshots)
      .set({
        revision: input.nextRevision,
        snapshot: input.snapshot,
      })
      .where(
        and(
          eq(dealIntakeSnapshots.dealId, input.dealId),
          eq(dealIntakeSnapshots.revision, input.expectedRevision),
        ),
      )
      .returning({ dealId: dealIntakeSnapshots.dealId });

    return updated.length > 0;
  }

  async createDealCalculationLinks(
    input: {
      calculationId: string;
      dealId: string;
      id: string;
      sourceQuoteId?: string | null;
    }[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db
      .insert(dealCalculationLinks)
      .values(
        input.map((link) => ({
          calculationId: link.calculationId,
          dealId: link.dealId,
          id: link.id,
          sourceQuoteId: link.sourceQuoteId ?? null,
        })),
      )
      .onConflictDoNothing({
        target: [dealCalculationLinks.dealId, dealCalculationLinks.calculationId],
      });
  }

  async replaceDealLegs(input: {
    dealId: string;
    legs: CreateDealLegStoredInput[];
  }): Promise<void> {
    await this.db.delete(dealLegs).where(eq(dealLegs.dealId, input.dealId));

    if (input.legs.length === 0) {
      return;
    }

    await this.db.insert(dealLegs).values(
      input.legs.map((leg) => ({
        dealId: leg.dealId,
        id: leg.id,
        idx: leg.idx,
        kind: leg.kind,
        state: leg.state,
      })),
    );
  }

  async replaceDealParticipants(input: {
    dealId: string;
    participants: CreateDealParticipantStoredInput[];
  }): Promise<void> {
    await this.db
      .delete(dealParticipants)
      .where(eq(dealParticipants.dealId, input.dealId));

    if (input.participants.length === 0) {
      return;
    }

    await this.db.insert(dealParticipants).values(
      input.participants.map((participant) => ({
        counterpartyId: participant.counterpartyId,
        customerId: participant.customerId,
        dealId: participant.dealId,
        id: participant.id,
        organizationId: participant.organizationId,
        role: participant.role,
      })),
    );
  }

  async replaceDealOperationalPositions(input: {
    dealId: string;
    positions: ReplaceDealOperationalPositionStoredInput[];
  }): Promise<void> {
    await this.db
      .delete(dealOperationalPositions)
      .where(eq(dealOperationalPositions.dealId, input.dealId));

    if (input.positions.length === 0) {
      return;
    }

    await this.db.insert(dealOperationalPositions).values(
      input.positions.map((position) => ({
        amountMinor: position.amountMinor,
        currencyId: position.currencyId,
        dealId: position.dealId,
        id: position.id,
        kind: position.kind,
        reasonCode: position.reasonCode,
        sourceRefs: position.sourceRefs,
        state: position.state,
      })),
    );
  }

  async createDealTimelineEvents(
    input: CreateDealTimelineEventStoredInput[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db
      .insert(dealTimelineEvents)
      .values(
        input.map((event) => ({
          actorLabel: event.actorLabel,
          actorUserId: event.actorUserId,
          dealId: event.dealId,
          id: event.id,
          occurredAt: event.occurredAt,
          payload: event.payload,
          sourceRef: event.sourceRef,
          type: event.type,
          visibility: event.visibility,
        })),
      )
      .onConflictDoNothing({
        target: [dealTimelineEvents.dealId, dealTimelineEvents.sourceRef],
      });
  }

  async createDealQuoteAcceptance(
    input: CreateDealQuoteAcceptanceStoredInput,
  ): Promise<void> {
    await this.db.insert(dealQuoteAcceptances).values({
      acceptedAt: input.acceptedAt,
      acceptedByUserId: input.acceptedByUserId,
      agreementVersionId: input.agreementVersionId,
      dealId: input.dealId,
      dealRevision: input.dealRevision,
      id: input.id,
      quoteId: input.quoteId,
      replacedByQuoteId: null,
      revokedAt: null,
    });
  }

  async supersedeCurrentQuoteAcceptances(input: {
    dealId: string;
    replacedByQuoteId: string;
    revokedAt: Date;
  }): Promise<void> {
    await this.db
      .update(dealQuoteAcceptances)
      .set({
        replacedByQuoteId: input.replacedByQuoteId,
        revokedAt: input.revokedAt,
      })
      .where(
        and(
          eq(dealQuoteAcceptances.dealId, input.dealId),
          isNull(dealQuoteAcceptances.revokedAt),
        ),
      );
  }

  async upsertDealCapabilityState(
    input: UpsertDealCapabilityStateStoredInput,
  ): Promise<void> {
    await this.db
      .insert(dealCapabilityStates)
      .values({
        applicantCounterpartyId: input.applicantCounterpartyId,
        capabilityKind: input.capabilityKind,
        dealType: input.dealType,
        id: input.id,
        internalEntityOrganizationId: input.internalEntityOrganizationId,
        note: input.note,
        reasonCode: input.reasonCode,
        status: input.status,
        updatedByUserId: input.updatedByUserId,
      })
      .onConflictDoUpdate({
        target: [
          dealCapabilityStates.applicantCounterpartyId,
          dealCapabilityStates.internalEntityOrganizationId,
          dealCapabilityStates.dealType,
          dealCapabilityStates.capabilityKind,
        ],
        set: {
          note: input.note,
          reasonCode: input.reasonCode,
          status: input.status,
          updatedByUserId: input.updatedByUserId,
          updatedAt: new Date(),
        },
      });
  }

  async createDealApprovals(
    input: CreateDealApprovalStoredInput[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db.insert(dealApprovals).values(
      input.map((approval) => ({
        approvalType: approval.approvalType,
        comment: approval.comment,
        dealId: approval.dealId,
        decidedAt: approval.decidedAt,
        decidedBy: approval.decidedBy,
        id: approval.id,
        requestedAt: approval.requestedAt,
        requestedBy: approval.requestedBy,
        status: approval.status,
      })),
    );
  }

  async setDealRoot(input: {
    agentId?: string | null;
    calculationId?: string | null;
    dealId: string;
    nextAction?: string | null;
    sourceAmountMinor?: bigint | null;
    sourceCurrencyId?: string | null;
    status?: CreateDealRootInput["status"];
    targetCurrencyId?: string | null;
  }): Promise<void> {
    const values: Record<string, unknown> = {};

    if ("agentId" in input) {
      values.agentId = input.agentId ?? null;
    }
    if ("calculationId" in input) {
      values.calculationId = input.calculationId ?? null;
    }
    if ("nextAction" in input) {
      values.nextAction = input.nextAction ?? null;
    }
    if ("sourceAmountMinor" in input) {
      values.sourceAmountMinor = input.sourceAmountMinor ?? null;
    }
    if ("sourceCurrencyId" in input) {
      values.sourceCurrencyId = input.sourceCurrencyId ?? null;
    }
    if ("targetCurrencyId" in input) {
      values.targetCurrencyId = input.targetCurrencyId ?? null;
    }
    if ("status" in input) {
      values.status = input.status;
    }

    if (Object.keys(values).length === 0) {
      return;
    }

    await this.db.update(deals).set(values).where(eq(deals.id, input.dealId));
  }

  async updateDealLegState(input: {
    dealId: string;
    idx: number;
    state: CreateDealLegStoredInput["state"];
  }): Promise<boolean> {
    const updated = await this.db
      .update(dealLegs)
      .set({
        state: input.state,
      })
      .where(and(eq(dealLegs.dealId, input.dealId), eq(dealLegs.idx, input.idx)))
      .returning({ id: dealLegs.id });

    return updated.length > 0;
  }
}
