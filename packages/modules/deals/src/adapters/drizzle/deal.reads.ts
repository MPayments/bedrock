import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  calculationLines,
  calculationSnapshots,
  calculations,
} from "@bedrock/calculations/schema";
import type { CurrenciesQueries } from "@bedrock/currencies/queries";
import type { PartiesQueries } from "@bedrock/parties/queries";
import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  dealAttachmentIngestions,
  dealApprovals,
  dealCapabilityStates,
  dealCalculationLinks,
  dealIntakeSnapshots,
  dealLegs,
  dealLegOperationLinks,
  dealParticipants,
  deals,
  dealTimelineEvents,
} from "./schema";
import type {
  Deal,
  DealApproval,
  DealAttachmentIngestion,
  DealCalculationHistoryItem,
  DealCapabilityState,
  DealDetails,
  DealFundingResolution,
  DealIntakeDraft,
  DealQuoteAcceptance,
  DealTimelineEvent,
  DealTraceProjection,
  DealWorkflowParticipant,
  DealWorkflowProjection,
  PortalDealCalculationSummary,
  PortalDealListProjection,
  PortalDealProjection,
} from "../../application/contracts/dto";
import type { ListDealsQuery } from "../../application/contracts/queries";
import type {
  DealFundingAssessmentPort,
  DealReads,
} from "../../application/ports/deal.reads";
import { getPrimaryDealAmountFields } from "../../application/shared/primary-amount-fields";
import { buildDealOperationalState } from "../../domain/operational-state";
import { listDealTransitionReadiness } from "../../domain/transition-policy";
import {
  buildEffectiveDealExecutionPlan,
  dealIntakeHasConvertLeg,
  deriveDealNextAction,
  evaluateDealSectionCompleteness,
  filterTimelineForPortal,
} from "../../domain/workflow";

const DEALS_SORT_COLUMN_MAP = {
  createdAt: deals.createdAt,
  status: deals.status,
  type: deals.type,
  updatedAt: deals.updatedAt,
} as const;

const DEAL_COMMENT_SQL = sql<string | null>`${sql.identifier("deals")}.${sql.identifier("comment")}`;

function minorToDecimalString(amountMinor: bigint | string, precision: number) {
  const value = typeof amountMinor === "string" ? BigInt(amountMinor) : amountMinor;
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const digits = absolute.toString();

  if (precision === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(precision + 1, "0");
  const integerPart = padded.slice(0, padded.length - precision);
  const fractionPart = padded.slice(padded.length - precision);

  return `${negative ? "-" : ""}${integerPart}.${fractionPart}`;
}

function mapTimelineEvent(row: {
  actorLabel: string | null;
  actorUserId: string | null;
  id: string;
  occurredAt: Date;
  payload: Record<string, unknown> | null;
  type: DealTimelineEvent["type"];
  visibility: "customer_safe" | "internal";
}): DealTimelineEvent {
  return {
    actor:
      row.actorUserId || row.actorLabel
        ? {
            label: row.actorLabel,
            userId: row.actorUserId,
          }
        : null,
    id: row.id,
    occurredAt: row.occurredAt,
    payload: row.payload ?? {},
    type: row.type,
    visibility: row.visibility,
  };
}

function mapQuoteAcceptance(row: {
  acceptedAt: Date | string;
  acceptedByUserId: string;
  agreementVersionId: string | null;
  dealId: string;
  dealRevision: number;
  expiresAt: Date | string | null;
  id: string;
  quoteId: string;
  quoteStatus: string;
  replacedByQuoteId: string | null;
  revokedAt: Date | null;
  usedAt: Date | string | null;
  usedDocumentId: string | null;
}): DealQuoteAcceptance {
  return {
    acceptedAt: toDate(row.acceptedAt),
    acceptedByUserId: row.acceptedByUserId,
    agreementVersionId: row.agreementVersionId,
    dealId: row.dealId,
    dealRevision: Number(row.dealRevision),
    expiresAt: toDateOrNull(row.expiresAt),
    id: row.id,
    quoteId: row.quoteId,
    quoteStatus: row.quoteStatus,
    replacedByQuoteId: row.replacedByQuoteId,
    revokedAt: row.revokedAt,
    usedAt: toDateOrNull(row.usedAt),
    usedDocumentId: row.usedDocumentId,
  };
}

function toDate(value: Date | string) {
  return value instanceof Date ? new Date(value) : new Date(value);
}

function toDateOrNull(value: Date | string | null | undefined) {
  return value ? toDate(value) : null;
}

function mapCapabilityState(row: {
  applicantCounterpartyId: string;
  capabilityKind: DealCapabilityState["kind"];
  dealType: DealCapabilityState["dealType"];
  internalEntityOrganizationId: string;
  note: string | null;
  reasonCode: string | null;
  status: DealCapabilityState["status"];
  updatedAt: Date;
  updatedByUserId: string | null;
}): DealCapabilityState {
  return {
    applicantCounterpartyId: row.applicantCounterpartyId,
    dealType: row.dealType,
    internalEntityOrganizationId: row.internalEntityOrganizationId,
    kind: row.capabilityKind,
    note: row.note,
    reasonCode: row.reasonCode,
    status: row.status,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  };
}

function mapAttachmentIngestion(row: {
  appliedFields: string[] | null;
  appliedRevision: number | null;
  attempts: number;
  availableAt: Date;
  errorCode: string | null;
  errorMessage: string | null;
  fileAssetId: string;
  lastProcessedAt: Date | null;
  normalizedPayload: Record<string, unknown> | null;
  observedRevision: number;
  skippedFields: string[] | null;
  status: DealAttachmentIngestion["status"];
  updatedAt: Date;
}): DealAttachmentIngestion {
  return {
    appliedFields: row.appliedFields ?? [],
    appliedRevision:
      row.appliedRevision === null ? null : Number(row.appliedRevision),
    attempts: Number(row.attempts),
    availableAt: row.availableAt,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    fileAssetId: row.fileAssetId,
    lastProcessedAt: row.lastProcessedAt,
    normalizedPayload:
      (row.normalizedPayload as DealAttachmentIngestion["normalizedPayload"]) ??
      null,
    observedRevision: Number(row.observedRevision),
    skippedFields: row.skippedFields ?? [],
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

function buildCompatibilityStatusHistory(
  timeline: DealTimelineEvent[],
  currentStatus: Deal["status"],
): DealDetails["statusHistory"] {
  const result = timeline
    .filter(
      (event) => event.type === "status_changed" || event.type === "deal_created",
    )
    .map((event) => ({
      changedBy: event.actor?.userId ?? null,
      comment:
        typeof event.payload.comment === "string" ? event.payload.comment : null,
      createdAt: event.occurredAt,
      id: event.id,
      status:
        event.type === "status_changed" &&
        typeof event.payload.status === "string"
          ? (event.payload.status as Deal["status"])
          : currentStatus,
    }));

  return result;
}

function buildCompatibilityParticipants(
  participants: DealWorkflowParticipant[],
): DealDetails["participants"] {
  return participants.map((participant) => {
    if (participant.role === "customer") {
      return {
        counterpartyId: null,
        createdAt: new Date(0),
        customerId: participant.customerId,
        id: participant.id,
        organizationId: null,
        partyId: participant.customerId!,
        role: "customer" as const,
        updatedAt: new Date(0),
      };
    }

    if (participant.role === "internal_entity") {
      return {
        counterpartyId: null,
        createdAt: new Date(0),
        customerId: null,
        id: participant.id,
        organizationId: participant.organizationId,
        partyId: participant.organizationId!,
        role: "organization" as const,
        updatedAt: new Date(0),
      };
    }

    return {
      counterpartyId: participant.counterpartyId,
      createdAt: new Date(0),
      customerId: null,
      id: participant.id,
      organizationId: null,
      partyId: participant.counterpartyId!,
      role: "counterparty" as const,
      updatedAt: new Date(0),
    };
  });
}

function buildDealSummaryView(input: {
  agreementId: string;
  agentId: string | null;
  calculationId: string | null;
  comment: string | null;
  createdAt: Date;
  customerId: string;
  id: string;
  intake: DealIntakeDraft;
  nextAction: string | null;
  revision: number;
  status: Deal["status"];
  type: Deal["type"];
  updatedAt: Date;
}): Deal {
  const primaryAmountFields = getPrimaryDealAmountFields(input.intake);

  return {
    agreementId: input.agreementId,
    amount: primaryAmountFields.amount,
    agentId: input.agentId,
    calculationId: input.calculationId,
    comment: input.comment,
    currencyId: primaryAmountFields.currencyId,
    createdAt: input.createdAt,
    customerId: input.customerId,
    id: input.id,
    intakeComment: input.intake.common.customerNote,
    nextAction: input.nextAction,
    reason: input.intake.moneyRequest.purpose,
    revision: input.revision,
    status: input.status,
    type: input.type,
    updatedAt: input.updatedAt,
  };
}

function buildPortalCalculationSummary(
  calculationId: string | null,
): PortalDealCalculationSummary {
  return calculationId ? { id: calculationId } : null;
}

interface DealSummaryRow {
  agreementId: string;
  agentId: string | null;
  calculationId: string | null;
  comment: string | null;
  createdAt: Date;
  customerId: string;
  id: string;
  intakeRevision: number;
  nextAction: string | null;
  snapshot: DealIntakeDraft;
  sourceAmountMinor: bigint | null;
  sourceCurrencyId: string | null;
  status: Deal["status"];
  targetCurrencyId: string | null;
  type: Deal["type"];
  updatedAt: Date;
}

interface RawDealQuoteRow extends Record<string, unknown> {
  createdAt: Date | string;
  dealId: string | null;
  expiresAt: Date | string | null;
  id: string;
  status: string;
  usedDocumentId: string | null;
}

interface DealQuoteRow {
  createdAt: Date;
  dealId: string | null;
  expiresAt: Date;
  id: string;
  status: string;
  usedDocumentId: string | null;
}

export interface DealTraceDocumentRow {
  approvalStatus: string;
  dealId: string | null;
  documentId: string;
  docType: string;
  ledgerOperationIds: string[];
  lifecycleStatus: string;
  occurredAt: Date;
  postingStatus: string;
  submissionStatus: string;
}

export interface DealDocumentsReadModel {
  listDealTraceRowsByDealId(dealId: string): Promise<DealTraceDocumentRow[]>;
}

export class DrizzleDealReads implements DealReads {
  constructor(
    private readonly db: Queryable,
    private readonly currenciesQueries: Pick<CurrenciesQueries, "listByIds">,
    private readonly partiesQueries: Pick<
      PartiesQueries,
      "counterparties" | "customers" | "organizations"
    >,
    private readonly documentsReadModel?: DealDocumentsReadModel,
    private readonly fundingAssessment?: DealFundingAssessmentPort,
  ) {}

  private async loadSummaryRow(id: string): Promise<DealSummaryRow | null> {
    const [row] = await this.db
      .select({
        agreementId: deals.agreementId,
        agentId: deals.agentId,
        calculationId: deals.calculationId,
        comment: DEAL_COMMENT_SQL,
        createdAt: deals.createdAt,
        customerId: deals.customerId,
        id: deals.id,
        intakeRevision: dealIntakeSnapshots.revision,
        nextAction: deals.nextAction,
        snapshot: dealIntakeSnapshots.snapshot,
        sourceAmountMinor: deals.sourceAmountMinor,
        sourceCurrencyId: deals.sourceCurrencyId,
        status: deals.status,
        targetCurrencyId: deals.targetCurrencyId,
        type: deals.type,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .innerJoin(dealIntakeSnapshots, eq(deals.id, dealIntakeSnapshots.dealId))
      .where(eq(deals.id, id))
      .limit(1);

    return row ?? null;
  }

  private async loadSummaryRowsByIds(ids: string[]): Promise<DealSummaryRow[]> {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

    if (uniqueIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        agreementId: deals.agreementId,
        agentId: deals.agentId,
        calculationId: deals.calculationId,
        comment: DEAL_COMMENT_SQL,
        createdAt: deals.createdAt,
        customerId: deals.customerId,
        id: deals.id,
        intakeRevision: dealIntakeSnapshots.revision,
        nextAction: deals.nextAction,
        snapshot: dealIntakeSnapshots.snapshot,
        sourceAmountMinor: deals.sourceAmountMinor,
        sourceCurrencyId: deals.sourceCurrencyId,
        status: deals.status,
        targetCurrencyId: deals.targetCurrencyId,
        type: deals.type,
        updatedAt: deals.updatedAt,
      })
      .from(deals)
      .innerJoin(dealIntakeSnapshots, eq(deals.id, dealIntakeSnapshots.dealId))
      .where(inArray(deals.id, uniqueIds));

    const rowById = new Map(rows.map((row) => [row.id, row] as const));

    return uniqueIds
      .map((id) => rowById.get(id) ?? null)
      .filter((row): row is DealSummaryRow => row !== null);
  }

  private async loadWorkflowParticipants(
    dealId: string,
  ): Promise<DealWorkflowParticipant[]> {
    const rows = await this.db
      .select({
        counterpartyId: dealParticipants.counterpartyId,
        customerId: dealParticipants.customerId,
        id: dealParticipants.id,
        organizationId: dealParticipants.organizationId,
        role: dealParticipants.role,
      })
      .from(dealParticipants)
      .where(eq(dealParticipants.dealId, dealId))
      .orderBy(asc(dealParticipants.createdAt));

    const customerIds = rows
      .map((row) => row.customerId)
      .filter((customerId): customerId is string => customerId !== null);
    const counterpartyIds = rows
      .map((row) => row.counterpartyId)
      .filter((counterpartyId): counterpartyId is string => counterpartyId !== null);
    const organizationIds = rows
      .map((row) => row.organizationId)
      .filter((organizationId): organizationId is string => organizationId !== null);

    const [
      customerDisplayNames,
      counterpartyShortNames,
      organizationShortNames,
    ] = await Promise.all([
      this.partiesQueries.customers.listNamesById(customerIds),
      this.partiesQueries.counterparties.listShortNamesById(counterpartyIds),
      this.partiesQueries.organizations.listShortNamesById(organizationIds),
    ]);

    return rows.map((row) => ({
      counterpartyId: row.counterpartyId,
      customerId: row.customerId,
      displayName:
        (row.customerId
          ? customerDisplayNames.get(row.customerId)
          : undefined) ??
        (row.organizationId
          ? organizationShortNames.get(row.organizationId)
          : undefined) ??
        (row.counterpartyId
          ? counterpartyShortNames.get(row.counterpartyId)
          : undefined) ??
        null,
      id: row.id,
      organizationId: row.organizationId,
      role: row.role,
    }));
  }

  private async loadTimeline(dealId: string): Promise<DealTimelineEvent[]> {
    const rows = await this.db
      .select({
        actorLabel: dealTimelineEvents.actorLabel,
        actorUserId: dealTimelineEvents.actorUserId,
        id: dealTimelineEvents.id,
        occurredAt: dealTimelineEvents.occurredAt,
        payload: dealTimelineEvents.payload,
        type: dealTimelineEvents.type,
        visibility: dealTimelineEvents.visibility,
      })
      .from(dealTimelineEvents)
      .where(eq(dealTimelineEvents.dealId, dealId))
      .orderBy(asc(dealTimelineEvents.occurredAt), asc(dealTimelineEvents.createdAt));

    return rows.map(mapTimelineEvent);
  }

  private async loadStoredLegs(
    dealId: string,
  ): Promise<DealWorkflowProjection["executionPlan"]> {
    const [rows, operationRefRows] = await Promise.all([
      this.db
        .select({
          id: dealLegs.id,
          idx: dealLegs.idx,
          kind: dealLegs.kind,
          state: dealLegs.state,
        })
        .from(dealLegs)
        .where(eq(dealLegs.dealId, dealId))
        .orderBy(asc(dealLegs.idx)),
      this.db
        .select({
          dealLegId: dealLegOperationLinks.dealLegId,
          kind: dealLegOperationLinks.operationKind,
          operationId: dealLegOperationLinks.treasuryOperationId,
          sourceRef: dealLegOperationLinks.sourceRef,
        })
        .from(dealLegOperationLinks)
        .innerJoin(dealLegs, eq(dealLegOperationLinks.dealLegId, dealLegs.id))
        .where(eq(dealLegs.dealId, dealId))
        .orderBy(asc(dealLegs.idx), asc(dealLegOperationLinks.createdAt)),
    ]);

    const operationRefsByLegId = new Map<
      string,
      DealWorkflowProjection["executionPlan"][number]["operationRefs"]
    >();

    for (const row of operationRefRows) {
      const operationRefs = operationRefsByLegId.get(row.dealLegId) ?? [];
      operationRefs.push({
        kind: row.kind,
        operationId: row.operationId,
        sourceRef: row.sourceRef,
      });
      operationRefsByLegId.set(row.dealLegId, operationRefs);
    }

    return rows.map((row) => ({
      id: row.id,
      idx: row.idx,
      kind: row.kind,
      operationRefs: operationRefsByLegId.get(row.id) ?? [],
      state: row.state,
    }));
  }

  private async loadCapabilityStatesForWorkflow(input: {
    applicantCounterpartyId: string | null;
    dealType: DealCapabilityState["dealType"];
    internalEntityOrganizationId: string | null;
  }): Promise<DealCapabilityState[]> {
    if (!input.applicantCounterpartyId || !input.internalEntityOrganizationId) {
      return [];
    }

    return this.listCapabilityStates({
      applicantCounterpartyId: input.applicantCounterpartyId,
      dealType: input.dealType,
      internalEntityOrganizationId: input.internalEntityOrganizationId,
    });
  }

  private async loadAcceptedQuote(
    dealId: string,
    revision: number,
  ): Promise<DealQuoteAcceptance | null> {
    const result = await this.db.execute<{
      acceptedAt: Date;
      acceptedByUserId: string;
      agreementVersionId: string | null;
      dealId: string;
      dealRevision: number;
      expiresAt: Date | null;
      id: string;
      quoteId: string;
      quoteStatus: string;
      replacedByQuoteId: string | null;
      revokedAt: Date | null;
      usedAt: Date | null;
      usedDocumentId: string | null;
    }>(sql`
      select
        a.accepted_at as "acceptedAt",
        a.accepted_by_user_id as "acceptedByUserId",
        a.agreement_version_id as "agreementVersionId",
        a.deal_id as "dealId",
        a.deal_revision as "dealRevision",
        q.expires_at as "expiresAt",
        a.id,
        a.quote_id as "quoteId",
        q.status as "quoteStatus",
        a.replaced_by_quote_id as "replacedByQuoteId",
        a.revoked_at as "revokedAt",
        q.used_at as "usedAt",
        q.used_document_id as "usedDocumentId"
      from deal_quote_acceptances a
      inner join fx_quotes q
        on q.id = a.quote_id
      where a.deal_id = ${dealId}
        and a.deal_revision = ${revision}
        and a.revoked_at is null
      order by a.accepted_at desc
      limit 1
    `);
    const [row] = result.rows;

    return row ? mapQuoteAcceptance(row) : null;
  }

  private async assessFundingResolution(input: {
    acceptedQuote: DealQuoteAcceptance | null;
    intake: DealIntakeDraft;
    participants: DealWorkflowParticipant[];
  }): Promise<DealFundingResolution> {
    const hasConvertLeg = dealIntakeHasConvertLeg(input.intake);

    if (!this.fundingAssessment) {
      return {
        availableMinor: null,
        fundingOrganizationId: null,
        fundingRequisiteId: null,
        reasonCode: hasConvertLeg
          ? "funding_assessment_unavailable"
          : "no_convert_leg",
        requiredAmountMinor: null,
        state: hasConvertLeg ? "blocked" : "not_applicable",
        strategy: null,
        targetCurrency: null,
        targetCurrencyId: input.intake.moneyRequest.targetCurrencyId ?? null,
      };
    }

    return this.fundingAssessment.assessFunding({
      acceptedQuoteId: input.acceptedQuote?.quoteId ?? null,
      hasConvertLeg,
      internalEntityOrganizationId:
        input.participants.find(
          (participant) => participant.role === "internal_entity",
        )?.organizationId ?? null,
      targetCurrencyId: input.intake.moneyRequest.targetCurrencyId ?? null,
    });
  }

  private async loadApprovals(dealId: string): Promise<DealApproval[]> {
    const rows = await this.db
      .select({
        approvalType: dealApprovals.approvalType,
        comment: dealApprovals.comment,
        decidedAt: dealApprovals.decidedAt,
        decidedBy: dealApprovals.decidedBy,
        id: dealApprovals.id,
        requestedAt: dealApprovals.requestedAt,
        requestedBy: dealApprovals.requestedBy,
        status: dealApprovals.status,
      })
      .from(dealApprovals)
      .where(eq(dealApprovals.dealId, dealId))
      .orderBy(asc(dealApprovals.requestedAt));

    return rows.map((row) => ({
      ...row,
    }));
  }

  private async loadFormalDocuments(
    dealId: string,
  ): Promise<DealWorkflowProjection["relatedResources"]["formalDocuments"]> {
    if (!this.documentsReadModel) {
      return [];
    }

    const rows = await this.documentsReadModel.listDealTraceRowsByDealId(dealId);

    return rows.map((row) => ({
      approvalStatus: row.approvalStatus,
      createdAt: row.occurredAt,
      docType: row.docType,
      id: row.documentId,
      lifecycleStatus: row.lifecycleStatus,
      occurredAt: row.occurredAt,
      postingStatus: row.postingStatus,
      submissionStatus: row.submissionStatus,
    }));
  }

  private async loadCalculationOperationalLines(calculationId: string | null) {
    if (!calculationId) {
      return [];
    }

    const rows = await this.db
      .select({
        amountMinor: calculationLines.amountMinor,
        currencyId: calculationLines.currencyId,
        kind: calculationLines.kind,
        updatedAt: calculationLines.updatedAt,
      })
      .from(calculationLines)
      .innerJoin(
        calculations,
        eq(calculationLines.calculationSnapshotId, calculations.currentSnapshotId),
      )
      .where(
        and(
          eq(calculations.id, calculationId),
          inArray(calculationLines.kind, ["fee_revenue", "spread_revenue"]),
        ),
      );

    const result: {
      amountMinor: string;
      currencyId: string;
      kind: "fee_revenue" | "spread_revenue";
      updatedAt: Date;
    }[] = [];

    for (const row of rows) {
      if (row.kind !== "fee_revenue" && row.kind !== "spread_revenue") {
        continue;
      }

      result.push({
        amountMinor: row.amountMinor.toString(),
        currencyId: row.currencyId,
        kind: row.kind,
        updatedAt: row.updatedAt,
      });
    }

    return result;
  }

  private async loadQuotes(dealId: string) {
    const result = await this.db.execute<RawDealQuoteRow>(sql`
      select
        id,
        deal_id as "dealId",
        created_at as "createdAt",
        expires_at as "expiresAt",
        status,
        used_document_id as "usedDocumentId"
      from fx_quotes
      where deal_id = ${dealId}
      order by created_at desc
    `);

    return result.rows.map((row): DealQuoteRow => ({
      ...row,
      createdAt: toDate(row.createdAt),
      expiresAt: toDate(row.expiresAt ?? new Date(0)),
    }));
  }

  private async loadCalculationRefs(dealId: string) {
    return this.db
      .select({
        createdAt: dealCalculationLinks.createdAt,
        id: dealCalculationLinks.calculationId,
        sourceQuoteId: dealCalculationLinks.sourceQuoteId,
      })
      .from(dealCalculationLinks)
      .where(eq(dealCalculationLinks.dealId, dealId))
      .orderBy(desc(dealCalculationLinks.createdAt));
  }

  private async loadAttachmentIngestions(
    dealId: string,
  ): Promise<DealAttachmentIngestion[]> {
    const rows = await this.db
      .select({
        appliedFields: dealAttachmentIngestions.appliedFields,
        appliedRevision: dealAttachmentIngestions.appliedRevision,
        attempts: dealAttachmentIngestions.attempts,
        availableAt: dealAttachmentIngestions.availableAt,
        errorCode: dealAttachmentIngestions.errorCode,
        errorMessage: dealAttachmentIngestions.errorMessage,
        fileAssetId: dealAttachmentIngestions.fileAssetId,
        lastProcessedAt: dealAttachmentIngestions.lastProcessedAt,
        normalizedPayload: dealAttachmentIngestions.normalizedPayload,
        observedRevision: dealAttachmentIngestions.observedRevision,
        skippedFields: dealAttachmentIngestions.skippedFields,
        status: dealAttachmentIngestions.status,
        updatedAt: dealAttachmentIngestions.updatedAt,
      })
      .from(dealAttachmentIngestions)
      .where(eq(dealAttachmentIngestions.dealId, dealId))
      .orderBy(desc(dealAttachmentIngestions.updatedAt));

    return rows.map(mapAttachmentIngestion);
  }

  private async buildWorkflowProjectionFromSummary(
    summary: DealSummaryRow,
  ): Promise<DealWorkflowProjection> {
    const [
      participants,
      timeline,
      acceptedQuote,
      approvals,
      storedLegs,
      calculationRefs,
      quotes,
      formalDocuments,
      attachmentIngestions,
    ] =
      await Promise.all([
        this.loadWorkflowParticipants(summary.id),
        this.loadTimeline(summary.id),
        this.loadAcceptedQuote(summary.id, Number(summary.intakeRevision)),
        this.loadApprovals(summary.id),
        this.loadStoredLegs(summary.id),
        this.loadCalculationRefs(summary.id),
        this.loadQuotes(summary.id),
        this.loadFormalDocuments(summary.id),
        this.loadAttachmentIngestions(summary.id),
      ]);
    const fundingResolution = await this.assessFundingResolution({
      acceptedQuote,
      intake: summary.snapshot,
      participants,
    });

    const sectionCompleteness = evaluateDealSectionCompleteness(summary.snapshot);
    const now = new Date();
    const executionPlan = buildEffectiveDealExecutionPlan({
      acceptance: acceptedQuote,
      documents: formalDocuments,
      fundingResolution,
      intake: summary.snapshot,
      now,
      storedLegs,
    });
    const [capabilityStates, calculationOperationalLines] = await Promise.all([
      this.loadCapabilityStatesForWorkflow({
        applicantCounterpartyId:
          participants.find((participant) => participant.role === "applicant")
            ?.counterpartyId ?? null,
        dealType: summary.type,
        internalEntityOrganizationId:
          participants.find(
            (participant) => participant.role === "internal_entity",
          )?.organizationId ?? null,
      }),
      this.loadCalculationOperationalLines(summary.calculationId),
    ]);
    const operationalState = buildDealOperationalState({
      calculationId: summary.calculationId,
      calculationLines: calculationOperationalLines,
      capabilityStates,
      executionPlan,
      intake: summary.snapshot,
      participants,
      sectionCompleteness,
      status: summary.status,
      updatedAt: summary.updatedAt,
    });
    const transitionReadiness = listDealTransitionReadiness({
      acceptance: acceptedQuote,
      approvals,
      calculationId: summary.calculationId,
      completeness: sectionCompleteness,
      documents: formalDocuments,
      executionPlan,
      intake: summary.snapshot,
      now,
      operationalState,
      participants,
      status: summary.status,
    });
    const nextAction = deriveDealNextAction({
      acceptance: acceptedQuote,
      calculationId: summary.calculationId,
      completeness: sectionCompleteness,
      executionPlan,
      intake: summary.snapshot,
      now,
      status: summary.status,
      transitionReadiness,
    });

    return {
      acceptedQuote,
      attachmentIngestions,
      executionPlan,
      fundingResolution,
      intake: summary.snapshot,
      nextAction,
      operationalState,
      participants,
      relatedResources: {
        attachments: [],
        calculations: calculationRefs.map((row) => ({
          createdAt: row.createdAt,
          id: row.id,
          sourceQuoteId: row.sourceQuoteId,
        })),
        formalDocuments,
        quotes: quotes.map((row) => ({
          expiresAt: row.expiresAt,
          id: row.id,
          status: row.status,
        })),
      },
      revision: Number(summary.intakeRevision),
      sectionCompleteness,
      summary: {
        agreementId: summary.agreementId,
        agentId: summary.agentId,
        calculationId: summary.calculationId,
        createdAt: summary.createdAt,
        id: summary.id,
        status: summary.status,
        type: summary.type,
        updatedAt: summary.updatedAt,
      },
      timeline,
      transitionReadiness,
    };
  }

  async findWorkflowById(id: string): Promise<DealWorkflowProjection | null> {
    const summary = await this.loadSummaryRow(id);
    if (!summary) {
      return null;
    }

    return this.buildWorkflowProjectionFromSummary(summary);
  }

  async findWorkflowsByIds(ids: string[]): Promise<DealWorkflowProjection[]> {
    const summaries = await this.loadSummaryRowsByIds(ids);

    return Promise.all(
      summaries.map((summary) => this.buildWorkflowProjectionFromSummary(summary)),
    );
  }

  async findAttachmentIngestionByFileAssetId(
    fileAssetId: string,
  ): Promise<DealAttachmentIngestion | null> {
    const [row] = await this.db
      .select({
        appliedFields: dealAttachmentIngestions.appliedFields,
        appliedRevision: dealAttachmentIngestions.appliedRevision,
        attempts: dealAttachmentIngestions.attempts,
        availableAt: dealAttachmentIngestions.availableAt,
        errorCode: dealAttachmentIngestions.errorCode,
        errorMessage: dealAttachmentIngestions.errorMessage,
        fileAssetId: dealAttachmentIngestions.fileAssetId,
        lastProcessedAt: dealAttachmentIngestions.lastProcessedAt,
        normalizedPayload: dealAttachmentIngestions.normalizedPayload,
        observedRevision: dealAttachmentIngestions.observedRevision,
        skippedFields: dealAttachmentIngestions.skippedFields,
        status: dealAttachmentIngestions.status,
        updatedAt: dealAttachmentIngestions.updatedAt,
      })
      .from(dealAttachmentIngestions)
      .where(eq(dealAttachmentIngestions.fileAssetId, fileAssetId))
      .limit(1);

    return row ? mapAttachmentIngestion(row) : null;
  }

  async listCapabilityStates(input: {
    applicantCounterpartyId?: string;
    capabilityKind?: DealCapabilityState["kind"];
    dealType?: DealCapabilityState["dealType"];
    internalEntityOrganizationId?: string;
    status?: DealCapabilityState["status"];
  }): Promise<DealCapabilityState[]> {
    const conditions: SQL[] = [];

    if (input.applicantCounterpartyId) {
      conditions.push(
        eq(
          dealCapabilityStates.applicantCounterpartyId,
          input.applicantCounterpartyId,
        ),
      );
    }
    if (input.internalEntityOrganizationId) {
      conditions.push(
        eq(
          dealCapabilityStates.internalEntityOrganizationId,
          input.internalEntityOrganizationId,
        ),
      );
    }
    if (input.dealType) {
      conditions.push(eq(dealCapabilityStates.dealType, input.dealType));
    }
    if (input.capabilityKind) {
      conditions.push(
        eq(dealCapabilityStates.capabilityKind, input.capabilityKind),
      );
    }
    if (input.status) {
      conditions.push(eq(dealCapabilityStates.status, input.status));
    }

    const rows = await this.db
      .select({
        applicantCounterpartyId: dealCapabilityStates.applicantCounterpartyId,
        capabilityKind: dealCapabilityStates.capabilityKind,
        dealType: dealCapabilityStates.dealType,
        internalEntityOrganizationId:
          dealCapabilityStates.internalEntityOrganizationId,
        note: dealCapabilityStates.note,
        reasonCode: dealCapabilityStates.reasonCode,
        status: dealCapabilityStates.status,
        updatedAt: dealCapabilityStates.updatedAt,
        updatedByUserId: dealCapabilityStates.updatedByUserId,
      })
      .from(dealCapabilityStates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        asc(dealCapabilityStates.dealType),
        asc(dealCapabilityStates.capabilityKind),
        asc(dealCapabilityStates.updatedAt),
      );

    return rows.map(mapCapabilityState);
  }

  async listAttachmentIngestionsByDealId(
    dealId: string,
  ): Promise<DealAttachmentIngestion[]> {
    return this.loadAttachmentIngestions(dealId);
  }

  async findPortalProjectionById(id: string): Promise<PortalDealProjection | null> {
    const workflow = await this.findWorkflowById(id);
    if (!workflow) {
      return null;
    }

    const applicant =
      workflow.participants.find((participant) => participant.role === "applicant") ??
      null;

    return {
      calculationSummary: buildPortalCalculationSummary(
        workflow.summary.calculationId,
      ),
      customerSafeIntake: {
        contractNumber: workflow.intake.incomingReceipt.contractNumber,
        customerNote: workflow.intake.common.customerNote,
        expectedAmount: workflow.intake.incomingReceipt.expectedAmount,
        expectedCurrencyId: workflow.intake.incomingReceipt.expectedCurrencyId,
        invoiceNumber: workflow.intake.incomingReceipt.invoiceNumber,
        purpose: workflow.intake.moneyRequest.purpose,
        requestedExecutionDate: workflow.intake.common.requestedExecutionDate,
        sourceAmount: workflow.intake.moneyRequest.sourceAmount,
        sourceCurrencyId: workflow.intake.moneyRequest.sourceCurrencyId,
        targetCurrencyId: workflow.intake.moneyRequest.targetCurrencyId,
      },
      nextAction: workflow.nextAction,
      summary: {
        applicantDisplayName: applicant?.displayName ?? null,
        createdAt: workflow.summary.createdAt,
        id: workflow.summary.id,
        status: workflow.summary.status,
        type: workflow.summary.type,
      },
      timeline: filterTimelineForPortal(workflow.timeline),
    };
  }

  async listPortalDeals(input: {
    customerId: string;
    limit: number;
    offset: number;
  }): Promise<PortalDealListProjection> {
    const [rows, countRows] = await Promise.all([
      this.db
        .select({ id: deals.id })
        .from(deals)
        .where(eq(deals.customerId, input.customerId))
        .orderBy(desc(deals.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(deals)
        .where(eq(deals.customerId, input.customerId)),
    ]);

    const projections = await Promise.all(
      rows.map(async (row) => {
        const portal = await this.findPortalProjectionById(row.id);
        if (!portal) {
          return null;
        }

        return {
          applicantDisplayName: portal.summary.applicantDisplayName,
          calculationSummary: portal.calculationSummary,
          createdAt: portal.summary.createdAt,
          id: portal.summary.id,
          nextAction: portal.nextAction,
          status: portal.summary.status,
          type: portal.summary.type,
        };
      }),
    );

    return {
      data: projections.filter((item): item is NonNullable<typeof item> => Boolean(item)),
      limit: input.limit,
      offset: input.offset,
      total: countRows[0]?.total ?? 0,
    };
  }

  async findById(id: string): Promise<DealDetails | null> {
    const summary = await this.loadSummaryRow(id);
    if (!summary) {
      return null;
    }

    const workflow = await this.buildWorkflowProjectionFromSummary(summary);
    const deal = buildDealSummaryView({
      agreementId: summary.agreementId,
      agentId: summary.agentId,
      calculationId: summary.calculationId,
      comment: summary.comment,
      createdAt: summary.createdAt,
      customerId:
        workflow.participants.find((participant) => participant.role === "customer")
          ?.customerId ?? "",
      id: summary.id,
      intake: workflow.intake,
      nextAction: workflow.nextAction,
      revision: workflow.revision,
      status: summary.status,
      type: summary.type,
      updatedAt: summary.updatedAt,
    });

    return {
      ...deal,
      approvals: await this.loadApprovals(id),
      legs: workflow.executionPlan.map((leg) => ({
        createdAt: workflow.summary.createdAt,
        id: `${workflow.summary.id}-${leg.idx}`,
        idx: leg.idx,
        kind: leg.kind,
        status: workflow.summary.status,
        updatedAt: workflow.summary.updatedAt,
      })),
      participants: buildCompatibilityParticipants(workflow.participants),
      statusHistory: buildCompatibilityStatusHistory(
        workflow.timeline,
        workflow.summary.status,
      ),
    };
  }

  async findTraceById(id: string): Promise<DealTraceProjection | null> {
    const workflow = await this.findWorkflowById(id);
    if (!workflow) {
      return null;
    }

    const [quotes, traceDocumentRows]: [DealQuoteRow[], DealTraceDocumentRow[]] =
      await Promise.all([
        this.loadQuotes(id),
        this.documentsReadModel?.listDealTraceRowsByDealId(id) ?? Promise.resolve([]),
      ]);
    const ledgerOperationIds = [
      ...new Set(traceDocumentRows.flatMap((row) => row.ledgerOperationIds)),
    ];

    return {
      calculationId: workflow.summary.calculationId,
      dealId: workflow.summary.id,
      formalDocuments: traceDocumentRows.map((row) => ({
        approvalStatus: row.approvalStatus,
        dealId: row.dealId,
        docType: row.docType,
        id: row.documentId,
        ledgerOperationIds: row.ledgerOperationIds,
        lifecycleStatus: row.lifecycleStatus,
        occurredAt: row.occurredAt,
        postingStatus: row.postingStatus,
        submissionStatus: row.submissionStatus,
      })),
      generatedFiles: [],
      ledgerOperationIds,
      quotes: quotes.map((row) => ({
        createdAt: row.createdAt,
        dealId: row.dealId,
        expiresAt: row.expiresAt,
        id: row.id,
        status: row.status,
        usedDocumentId: row.usedDocumentId,
      })),
      timeline: workflow.timeline,
    };
  }

  async list(input: ListDealsQuery): Promise<PaginatedList<Deal>> {
    const conditions: SQL[] = [];

    if (input.customerId) {
      conditions.push(eq(deals.customerId, input.customerId));
    }
    if (input.agreementId) {
      conditions.push(eq(deals.agreementId, input.agreementId));
    }
    if (input.calculationId) {
      conditions.push(eq(deals.calculationId, input.calculationId));
    }
    if (input.type) {
      conditions.push(eq(deals.type, input.type as typeof deals.$inferSelect.type));
    }
    if (input.status) {
      conditions.push(
        eq(deals.status, input.status as typeof deals.$inferSelect.status),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      DEALS_SORT_COLUMN_MAP,
      deals.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          agreementId: deals.agreementId,
          agentId: deals.agentId,
          calculationId: deals.calculationId,
          comment: DEAL_COMMENT_SQL,
          createdAt: deals.createdAt,
          customerId: deals.customerId,
          id: deals.id,
          intakeRevision: dealIntakeSnapshots.revision,
          nextAction: deals.nextAction,
          snapshot: dealIntakeSnapshots.snapshot,
          sourceAmountMinor: deals.sourceAmountMinor,
          sourceCurrencyId: deals.sourceCurrencyId,
          status: deals.status,
          targetCurrencyId: deals.targetCurrencyId,
          type: deals.type,
          updatedAt: deals.updatedAt,
        })
        .from(deals)
        .innerJoin(dealIntakeSnapshots, eq(deals.id, dealIntakeSnapshots.dealId))
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(deals)
        .where(where),
    ]);

    const extraCurrenciesById = await this.currenciesQueries.listByIds(
      rows
        .map((row) => row.sourceCurrencyId)
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    );

    return {
      data: rows.map((row) => {
        const precision = row.sourceCurrencyId
          ? extraCurrenciesById.get(row.sourceCurrencyId)?.precision ?? null
          : null;
        const primaryAmountFields = getPrimaryDealAmountFields(row.snapshot);
        const amount =
          row.type !== "payment" &&
          row.sourceAmountMinor != null &&
          precision != null
            ? minorToDecimalString(row.sourceAmountMinor, precision)
            : primaryAmountFields.amount;
        const deal = buildDealSummaryView({
          agreementId: row.agreementId,
          agentId: row.agentId,
          calculationId: row.calculationId,
          comment: row.comment,
          createdAt: row.createdAt,
          customerId: row.customerId,
          id: row.id,
          intake: row.snapshot,
          nextAction: row.nextAction,
          revision: Number(row.intakeRevision),
          status: row.status,
          type: row.type,
          updatedAt: row.updatedAt,
        });

        return {
          ...deal,
          amount,
        };
      }),
      limit: input.limit,
      offset: input.offset,
      total: countRows[0]?.total ?? 0,
    };
  }

  async listCalculationHistory(
    dealId: string,
  ): Promise<DealCalculationHistoryItem[]> {
    const rows = await this.db
      .select({
        baseCurrencyId: calculationSnapshots.baseCurrencyId,
        calculationCurrencyId: calculationSnapshots.calculationCurrencyId,
        calculationId: calculations.id,
        calculationTimestamp: calculationSnapshots.calculationTimestamp,
        createdAt: dealCalculationLinks.createdAt,
        totalFeeAmountMinor: calculationSnapshots.totalFeeAmountMinor,
        fxQuoteId: calculationSnapshots.fxQuoteId,
        originalAmountMinor: calculationSnapshots.originalAmountMinor,
        rateDen: calculationSnapshots.rateDen,
        rateNum: calculationSnapshots.rateNum,
        sourceQuoteId: dealCalculationLinks.sourceQuoteId,
        totalAmountMinor: calculationSnapshots.totalAmountMinor,
        totalInBaseMinor: calculationSnapshots.totalInBaseMinor,
        totalWithExpensesInBaseMinor:
          calculationSnapshots.totalWithExpensesInBaseMinor,
      })
      .from(dealCalculationLinks)
      .innerJoin(calculations, eq(dealCalculationLinks.calculationId, calculations.id))
      .innerJoin(
        calculationSnapshots,
        eq(calculations.currentSnapshotId, calculationSnapshots.id),
      )
      .where(eq(dealCalculationLinks.dealId, dealId))
      .orderBy(desc(dealCalculationLinks.createdAt));

    return rows.map((row) => ({
      baseCurrencyId: row.baseCurrencyId,
      calculationCurrencyId: row.calculationCurrencyId,
      calculationId: row.calculationId,
      calculationTimestamp: row.calculationTimestamp,
      createdAt: row.createdAt,
      totalFeeAmountMinor: row.totalFeeAmountMinor.toString(),
      fxQuoteId: row.fxQuoteId,
      originalAmountMinor: row.originalAmountMinor.toString(),
      rateDen: row.rateDen.toString(),
      rateNum: row.rateNum.toString(),
      sourceQuoteId: row.sourceQuoteId,
      totalAmountMinor: row.totalAmountMinor.toString(),
      totalInBaseMinor: row.totalInBaseMinor.toString(),
      totalWithExpensesInBaseMinor:
        row.totalWithExpensesInBaseMinor.toString(),
    }));
  }
}
