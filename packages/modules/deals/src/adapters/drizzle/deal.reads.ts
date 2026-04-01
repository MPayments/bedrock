import {
  and,
  asc,
  desc,
  eq,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import { minorToDecimalString } from "@bedrock/calculations";
import { calculationSnapshots, calculations } from "@bedrock/calculations/schema";
import type { CurrenciesQueries } from "@bedrock/currencies/queries";
import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";
import { counterparties, customers, organizations } from "@bedrock/parties/schema";

import {
  buildDealExecutionPlan,
  deriveDealNextAction,
  evaluateDealSectionCompleteness,
  filterTimelineForPortal,
} from "../../domain/workflow";
import {
  dealApprovals,
  dealCalculationLinks,
  dealIntakeSnapshots,
  dealLegs,
  dealParticipants,
  deals,
  dealQuoteAcceptances,
  dealTimelineEvents,
} from "./schema";
import type {
  Deal,
  DealApproval,
  DealCalculationHistoryItem,
  DealDetails,
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
import type { DealReads } from "../../application/ports/deal.reads";

const DEALS_SORT_COLUMN_MAP = {
  createdAt: deals.createdAt,
  status: deals.status,
  type: deals.type,
  updatedAt: deals.updatedAt,
} as const;

function toDisplayName(input: {
  counterpartyFullName: string | null;
  counterpartyShortName: string | null;
  customerDisplayName: string | null;
  organizationFullName: string | null;
  organizationShortName: string | null;
}): string | null {
  return (
    input.customerDisplayName ??
    input.organizationShortName ??
    input.organizationFullName ??
    input.counterpartyShortName ??
    input.counterpartyFullName ??
    null
  );
}

function mapTimelineEvent(row: {
  actorLabel: string | null;
  actorUserId: string | null;
  id: string;
  occurredAt: Date;
  payload: Record<string, unknown> | null;
  type:
    | "deal_created"
    | "intake_saved"
    | "participant_changed"
    | "status_changed"
    | "quote_created"
    | "quote_expired"
    | "quote_used"
    | "calculation_attached"
    | "attachment_uploaded"
    | "attachment_deleted"
    | "document_created"
    | "document_status_changed";
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
  acceptedAt: Date;
  acceptedByUserId: string;
  agreementVersionId: string | null;
  dealId: string;
  dealRevision: number;
  id: string;
  quoteId: string;
  replacedByQuoteId: string | null;
  revokedAt: Date | null;
}): DealQuoteAcceptance {
  return {
    acceptedAt: row.acceptedAt,
    acceptedByUserId: row.acceptedByUserId,
    agreementVersionId: row.agreementVersionId,
    dealId: row.dealId,
    dealRevision: Number(row.dealRevision),
    id: row.id,
    quoteId: row.quoteId,
    replacedByQuoteId: row.replacedByQuoteId,
    revokedAt: row.revokedAt,
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

function buildCompatibilityDeal(input: {
  agreementId: string;
  agentId: string | null;
  calculationId: string | null;
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
  return {
    agreementId: input.agreementId,
    agentId: input.agentId,
    calculationId: input.calculationId,
    comment: input.intake.common.customerNote,
    createdAt: input.createdAt,
    customerId: input.customerId,
    id: input.id,
    intakeComment: input.intake.common.customerNote,
    nextAction: input.nextAction,
    reason: input.intake.moneyRequest.purpose,
    requestedAmount: input.intake.moneyRequest.sourceAmount,
    requestedCurrencyId: input.intake.moneyRequest.sourceCurrencyId,
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

type DealSummaryRow = {
  agreementId: string;
  agentId: string | null;
  calculationId: string | null;
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
};

export class DrizzleDealReads implements DealReads {
  constructor(
    private readonly db: Queryable,
    private readonly currenciesQueries: Pick<CurrenciesQueries, "listByIds">,
  ) {}

  private async loadSummaryRow(id: string): Promise<DealSummaryRow | null> {
    const [row] = await this.db
      .select({
        agreementId: deals.agreementId,
        agentId: deals.agentId,
        calculationId: deals.calculationId,
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

  private async loadWorkflowParticipants(
    dealId: string,
  ): Promise<DealWorkflowParticipant[]> {
    const rows = await this.db
      .select({
        counterpartyFullName: counterparties.fullName,
        counterpartyId: dealParticipants.counterpartyId,
        counterpartyShortName: counterparties.shortName,
        customerDisplayName: customers.displayName,
        customerId: dealParticipants.customerId,
        id: dealParticipants.id,
        organizationFullName: organizations.fullName,
        organizationId: dealParticipants.organizationId,
        organizationShortName: organizations.shortName,
        role: dealParticipants.role,
      })
      .from(dealParticipants)
      .leftJoin(customers, eq(dealParticipants.customerId, customers.id))
      .leftJoin(
        counterparties,
        eq(dealParticipants.counterpartyId, counterparties.id),
      )
      .leftJoin(organizations, eq(dealParticipants.organizationId, organizations.id))
      .where(eq(dealParticipants.dealId, dealId))
      .orderBy(asc(dealParticipants.createdAt));

    return rows.map((row) => ({
      counterpartyId: row.counterpartyId,
      customerId: row.customerId,
      displayName: toDisplayName(row),
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

  private async loadAcceptedQuote(
    dealId: string,
  ): Promise<DealQuoteAcceptance | null> {
    const [row] = await this.db
      .select({
        acceptedAt: dealQuoteAcceptances.acceptedAt,
        acceptedByUserId: dealQuoteAcceptances.acceptedByUserId,
        agreementVersionId: dealQuoteAcceptances.agreementVersionId,
        dealId: dealQuoteAcceptances.dealId,
        dealRevision: dealQuoteAcceptances.dealRevision,
        id: dealQuoteAcceptances.id,
        quoteId: dealQuoteAcceptances.quoteId,
        replacedByQuoteId: dealQuoteAcceptances.replacedByQuoteId,
        revokedAt: dealQuoteAcceptances.revokedAt,
      })
      .from(dealQuoteAcceptances)
      .where(
        and(
          eq(dealQuoteAcceptances.dealId, dealId),
          isNull(dealQuoteAcceptances.revokedAt),
        ),
      )
      .orderBy(desc(dealQuoteAcceptances.acceptedAt))
      .limit(1);

    return row ? mapQuoteAcceptance(row) : null;
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

  private async loadQuotes(dealId: string) {
    const result = await this.db.execute<{
      createdAt: Date;
      dealId: string | null;
      expiresAt: Date;
      id: string;
      status: string;
      usedDocumentId: string | null;
    }>(sql`
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

    return result.rows;
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

  private async buildWorkflowProjectionFromSummary(
    summary: DealSummaryRow,
  ): Promise<DealWorkflowProjection> {
    const [participants, timeline, acceptedQuote, calculationRefs, quotes] =
      await Promise.all([
        this.loadWorkflowParticipants(summary.id),
        this.loadTimeline(summary.id),
        this.loadAcceptedQuote(summary.id),
        this.loadCalculationRefs(summary.id),
        this.loadQuotes(summary.id),
      ]);

    const sectionCompleteness = evaluateDealSectionCompleteness(summary.snapshot);
    const nextAction =
      summary.nextAction ??
      deriveDealNextAction({
        acceptance: acceptedQuote,
        calculationId: summary.calculationId,
        completeness: sectionCompleteness,
        intake: summary.snapshot,
        status: summary.status,
      });

    return {
      acceptedQuote,
      executionPlan: buildDealExecutionPlan(summary.snapshot),
      intake: summary.snapshot,
      nextAction,
      participants,
      relatedResources: {
        attachments: [],
        calculations: calculationRefs.map((row) => ({
          createdAt: row.createdAt,
          id: row.id,
          sourceQuoteId: row.sourceQuoteId,
        })),
        formalDocuments: [],
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
    };
  }

  async findWorkflowById(id: string): Promise<DealWorkflowProjection | null> {
    const summary = await this.loadSummaryRow(id);
    if (!summary) {
      return null;
    }

    return this.buildWorkflowProjectionFromSummary(summary);
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
    const workflow = await this.findWorkflowById(id);
    if (!workflow) {
      return null;
    }

    const compat = buildCompatibilityDeal({
      agreementId: workflow.summary.agreementId,
      agentId: workflow.summary.agentId,
      calculationId: workflow.summary.calculationId,
      createdAt: workflow.summary.createdAt,
      customerId:
        workflow.participants.find((participant) => participant.role === "customer")
          ?.customerId ?? "",
      id: workflow.summary.id,
      intake: workflow.intake,
      nextAction: workflow.nextAction,
      revision: workflow.revision,
      status: workflow.summary.status,
      type: workflow.summary.type,
      updatedAt: workflow.summary.updatedAt,
    });

    const approvals = await this.loadApprovals(id);

    return {
      ...compat,
      approvals,
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

    const quotes = await this.loadQuotes(id);

    return {
      calculationId: workflow.summary.calculationId,
      dealId: workflow.summary.id,
      formalDocuments: [],
      generatedFiles: [],
      ledgerOperationIds: [],
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
        const requestedAmount =
          row.sourceAmountMinor != null && precision != null
            ? minorToDecimalString(row.sourceAmountMinor, precision)
            : row.snapshot.moneyRequest.sourceAmount;
        const compat = buildCompatibilityDeal({
          agreementId: row.agreementId,
          agentId: row.agentId,
          calculationId: row.calculationId,
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
          ...compat,
          requestedAmount,
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
        feeAmountMinor: calculationSnapshots.feeAmountMinor,
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
      feeAmountMinor: row.feeAmountMinor.toString(),
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
