import { and, eq, isNull, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  dealAttachmentIngestions,
  dealApprovals,
  dealCalculationLinks,
  dealIntakeSnapshots,
  dealLegs,
  dealLegOperationLinks,
  dealOperationalPositions,
  dealPricingContexts,
  dealParticipants,
  deals,
  dealQuoteAcceptances,
  dealTimelineEvents,
} from "./schema";
import type {
  CreateDealApprovalStoredInput,
  CreateDealAttachmentIngestionStoredInput,
  CreateDealIntakeSnapshotStoredInput,
  CreateDealLegOperationLinkStoredInput,
  CreateDealLegStoredInput,
  CreateDealPricingContextStoredInput,
  CreateDealParticipantStoredInput,
  CreateDealQuoteAcceptanceStoredInput,
  CreateDealRootInput,
  CreateDealTimelineEventStoredInput,
  DealStore,
  ReplaceDealOperationalPositionStoredInput,
} from "../../application/ports/deal.store";

export class DrizzleDealStore implements DealStore {
  constructor(private readonly db: Queryable) {}

  async claimAttachmentIngestions(input: {
    batchSize: number;
    leaseSeconds: number;
    now: Date;
  }): Promise<
    {
      attempts: number;
      availableAt: Date;
      dealId: string;
      fileAssetId: string;
      observedRevision: number;
      status: "pending" | "processing" | "processed" | "failed";
    }[]
  > {
    const claimed = await this.db.execute(sql`
      WITH c AS (
        SELECT id
        FROM ${dealAttachmentIngestions}
        WHERE (
          (${dealAttachmentIngestions.status} = 'pending' AND ${dealAttachmentIngestions.availableAt} <= ${input.now})
          OR
          (${dealAttachmentIngestions.status} = 'processing'
            AND ${dealAttachmentIngestions.lockedAt} IS NOT NULL
            AND ${dealAttachmentIngestions.lockedAt} + (${input.leaseSeconds} * interval '1 second') <= ${input.now})
        )
        ORDER BY ${dealAttachmentIngestions.createdAt}
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.batchSize}
      )
      UPDATE ${dealAttachmentIngestions} ingest
        SET status = 'processing',
            locked_at = ${input.now},
            attempts = attempts + 1,
            error_code = NULL,
            error_message = NULL,
            updated_at = ${input.now}
      FROM c
      WHERE ingest.id = c.id
      RETURNING
        ingest.deal_id as deal_id,
        ingest.file_asset_id as file_asset_id,
        ingest.status as status,
        ingest.attempts as attempts,
        ingest.available_at as available_at,
        ingest.observed_revision as observed_revision
    `);

    return ((claimed.rows ?? []) as {
      attempts: number;
      available_at: Date;
      deal_id: string;
      file_asset_id: string;
      observed_revision: number;
      status: "pending" | "processing" | "processed" | "failed";
    }[]).map((row) => ({
      attempts: Number(row.attempts),
      availableAt: new Date(row.available_at),
      dealId: row.deal_id,
      fileAssetId: row.file_asset_id,
      observedRevision: Number(row.observed_revision),
      status: row.status,
    }));
  }

  async createDealAttachmentIngestion(
    input: CreateDealAttachmentIngestionStoredInput,
  ): Promise<void> {
    await this.db.insert(dealAttachmentIngestions).values({
      appliedFields: input.appliedFields,
      appliedRevision: input.appliedRevision,
      attempts: input.attempts,
      availableAt: input.availableAt,
      dealId: input.dealId,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      fileAssetId: input.fileAssetId,
      id: input.id,
      lastProcessedAt: input.lastProcessedAt,
      normalizedPayload: input.normalizedPayload,
      observedRevision: input.observedRevision,
      skippedFields: input.skippedFields,
      status: input.status,
    });
  }

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

  async createDealPricingContext(
    input: CreateDealPricingContextStoredInput,
  ): Promise<void> {
    await this.db.insert(dealPricingContexts).values({
      dealId: input.dealId,
      revision: input.revision,
      snapshot: input.snapshot,
    });
  }

  async createDealLegOperationLinks(
    input: CreateDealLegOperationLinkStoredInput[],
  ): Promise<void> {
    if (input.length === 0) {
      return;
    }

    await this.db
      .insert(dealLegOperationLinks)
      .values(
        input.map((link) => ({
          dealLegId: link.dealLegId,
          id: link.id,
          operationKind: link.operationKind,
          sourceRef: link.sourceRef,
          treasuryOperationId: link.treasuryOperationId,
        })),
      )
      .onConflictDoNothing({
        target: dealLegOperationLinks.sourceRef,
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

  async replaceDealPricingContext(input: {
    dealId: string;
    expectedRevision: number;
    nextRevision: number;
    snapshot: CreateDealPricingContextStoredInput["snapshot"];
  }): Promise<boolean> {
    const updated = await this.db
      .update(dealPricingContexts)
      .set({
        revision: input.nextRevision,
        snapshot: input.snapshot,
      })
      .where(
        and(
          eq(dealPricingContexts.dealId, input.dealId),
          eq(dealPricingContexts.revision, input.expectedRevision),
        ),
      )
      .returning({ dealId: dealPricingContexts.dealId });

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

  async setDealAttachmentIngestion(input: {
    appliedFields?: string[];
    appliedRevision?: number | null;
    availableAt?: Date;
    errorCode?: string | null;
    errorMessage?: string | null;
    fileAssetId: string;
    lastProcessedAt?: Date | null;
    normalizedPayload?: Record<string, unknown> | null;
    skippedFields?: string[];
    status?: "pending" | "processing" | "processed" | "failed";
  }): Promise<void> {
    const values: Record<string, unknown> = {
      updatedAt: sql`now()`,
    };

    if (input.appliedFields !== undefined) {
      values.appliedFields = input.appliedFields ?? [];
    }
    if (input.appliedRevision !== undefined) {
      values.appliedRevision = input.appliedRevision ?? null;
    }
    if (input.availableAt !== undefined) {
      values.availableAt = input.availableAt ?? sql`now()`;
    }
    if (input.errorCode !== undefined) {
      values.errorCode = input.errorCode ?? null;
    }
    if (input.errorMessage !== undefined) {
      values.errorMessage = input.errorMessage ?? null;
    }
    if (input.lastProcessedAt !== undefined) {
      values.lastProcessedAt = input.lastProcessedAt ?? null;
    }
    if (input.normalizedPayload !== undefined) {
      values.normalizedPayload = input.normalizedPayload ?? null;
    }
    if (input.skippedFields !== undefined) {
      values.skippedFields = input.skippedFields ?? [];
    }
    if (input.status !== undefined) {
      values.status = input.status ?? "pending";
      values.lockedAt = input.status === "processing" ? sql`now()` : null;
    }

    await this.db
      .update(dealAttachmentIngestions)
      .set(values)
      .where(eq(dealAttachmentIngestions.fileAssetId, input.fileAssetId));
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

  async revokeCurrentQuoteAcceptances(input: {
    dealId: string;
    revocationReason: string;
    revokedAt: Date;
  }): Promise<boolean> {
    const updated = await this.db
      .update(dealQuoteAcceptances)
      .set({
        revocationReason: input.revocationReason,
        revokedAt: input.revokedAt,
      })
      .where(
        and(
          eq(dealQuoteAcceptances.dealId, input.dealId),
          isNull(dealQuoteAcceptances.revokedAt),
        ),
      )
      .returning({ id: dealQuoteAcceptances.id });

    return updated.length > 0;
  }

  async upsertDealAttachmentIngestion(input: {
    availableAt: Date;
    dealId: string;
    fileAssetId: string;
    id: string;
    observedRevision: number;
  }): Promise<void> {
    await this.db
      .insert(dealAttachmentIngestions)
      .values({
        appliedFields: [],
        appliedRevision: null,
        attempts: 0,
        availableAt: input.availableAt,
        dealId: input.dealId,
        errorCode: null,
        errorMessage: null,
        fileAssetId: input.fileAssetId,
        id: input.id,
        lastProcessedAt: null,
        normalizedPayload: null,
        observedRevision: input.observedRevision,
        skippedFields: [],
        status: "pending",
      })
      .onConflictDoUpdate({
        target: [dealAttachmentIngestions.fileAssetId],
        set: {
          appliedFields: [],
          appliedRevision: null,
          attempts: 0,
          availableAt: input.availableAt,
          dealId: input.dealId,
          errorCode: null,
          errorMessage: null,
          lastProcessedAt: null,
          lockedAt: null,
          normalizedPayload: null,
          observedRevision: input.observedRevision,
          skippedFields: [],
          status: "pending",
          updatedAt: sql`now()`,
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
    agreementId?: string;
    agentId?: string | null;
    calculationId?: string | null;
    comment?: string | null;
    dealId: string;
    nextAction?: string | null;
    sourceAmountMinor?: bigint | null;
    sourceCurrencyId?: string | null;
    status?: CreateDealRootInput["status"];
    targetCurrencyId?: string | null;
  }): Promise<void> {
    const values: Record<string, unknown> = {};

    if ("agreementId" in input) {
      values.agreementId = input.agreementId;
    }
    if ("agentId" in input) {
      values.agentId = input.agentId ?? null;
    }
    if ("calculationId" in input) {
      values.calculationId = input.calculationId ?? null;
    }
    if ("comment" in input) {
      values.comment = input.comment ?? null;
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
