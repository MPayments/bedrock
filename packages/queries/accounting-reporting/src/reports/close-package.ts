import { and, eq, inArray, or, sql } from "drizzle-orm";

import { canonicalJson } from "@bedrock/core/canon";
import { sha256Hex } from "@bedrock/core/crypto";
import { ValidationError } from "@bedrock/core/errors";
import { assertInternalLedgerOrganization } from "@bedrock/organizations";

import type {
  AccountingReportsContext,
  CashFlowSummaryByCurrency,
  ClosePackageAdjustment,
  ClosePackageAuditEvent,
  ClosePackageResult,
  IncomeStatementSummaryByCurrency,
  TrialBalanceSummaryByCurrency,
} from "./types";
import {
  normalizeMonthStart,
  toBigInt,
  toDateValue,
  toJsonSafeValue,
} from "../internal/normalization";
import { schema } from "../internal/shared";
import type {
  CashFlowQuery,
  ClosePackageQuery,
  IncomeStatementQuery,
  TrialBalanceQuery,
} from "../reports-validation";
import { ClosePackageQuerySchema } from "../reports-validation";

export function createListClosePackageHandler(input: {
  context: AccountingReportsContext;
  listTrialBalance: (input?: TrialBalanceQuery) => Promise<{
    summaryByCurrency: TrialBalanceSummaryByCurrency[];
  }>;
  listIncomeStatement: (input?: IncomeStatementQuery) => Promise<{
    summaryByCurrency: IncomeStatementSummaryByCurrency[];
  }>;
  listCashFlow: (input?: CashFlowQuery) => Promise<{
    summaryByCurrency: CashFlowSummaryByCurrency[];
  }>;
}) {
  const { context, listTrialBalance, listIncomeStatement, listCashFlow } = input;

  return async function listClosePackage(
    inputQuery?: ClosePackageQuery,
  ): Promise<ClosePackageResult> {
    const query = ClosePackageQuerySchema.parse(inputQuery ?? {});
    const periodStart = normalizeMonthStart(new Date(query.periodStart));

    await assertInternalLedgerOrganization({
      db: context.db,
      organizationId: query.organizationId,
    });

    const organizationBooks = await context.db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(eq(schema.books.ownerId, query.organizationId));

    if (organizationBooks.length === 0) {
      throw new ValidationError(
        `No internal-ledger books found for organization ${query.organizationId}`,
      );
    }

    const organizationBookIds = organizationBooks.map((row) => row.id);

    const existingRows = await context.db
      .select()
      .from(schema.accountingClosePackages)
      .where(
        and(
          eq(schema.accountingClosePackages.organizationId, query.organizationId),
          eq(schema.accountingClosePackages.periodStart, periodStart),
        ),
      )
      .orderBy(sql`${schema.accountingClosePackages.revision} DESC`)
      .limit(1);

    if (existingRows[0]) {
      const row = existingRows[0];
      const payload = row.payload as Record<string, unknown>;
      const trialBalanceSummaryByCurrency = Array.isArray(payload.trialBalanceSummaryByCurrency)
        ? payload.trialBalanceSummaryByCurrency.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              currency: String(value.currency ?? ""),
              openingDebitMinor: toBigInt(value.openingDebitMinor),
              openingCreditMinor: toBigInt(value.openingCreditMinor),
              periodDebitMinor: toBigInt(value.periodDebitMinor),
              periodCreditMinor: toBigInt(value.periodCreditMinor),
              closingDebitMinor: toBigInt(value.closingDebitMinor),
              closingCreditMinor: toBigInt(value.closingCreditMinor),
            };
          })
        : [];
      const incomeStatementSummaryByCurrency = Array.isArray(
        payload.incomeStatementSummaryByCurrency,
      )
        ? payload.incomeStatementSummaryByCurrency.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              currency: String(value.currency ?? ""),
              revenueMinor: toBigInt(value.revenueMinor),
              expenseMinor: toBigInt(value.expenseMinor),
              netMinor: toBigInt(value.netMinor),
            };
          })
        : [];
      const cashFlowSummaryByCurrency = Array.isArray(payload.cashFlowSummaryByCurrency)
        ? payload.cashFlowSummaryByCurrency.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              currency: String(value.currency ?? ""),
              netCashFlowMinor: toBigInt(value.netCashFlowMinor),
            };
          })
        : [];
      const adjustments = Array.isArray(payload.adjustments)
        ? payload.adjustments.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              documentId: String(value.documentId ?? ""),
              docType: String(value.docType ?? ""),
              docNo: String(value.docNo ?? ""),
              occurredAt: toDateValue(value.occurredAt),
              title: String(value.title ?? ""),
            };
          })
        : [];
      const auditEvents = Array.isArray(payload.auditEvents)
        ? payload.auditEvents.map((item) => {
            const value = item as Record<string, unknown>;
            return {
              id: String(value.id ?? ""),
              eventType: String(value.eventType ?? ""),
              actorId: value.actorId ? String(value.actorId) : null,
              createdAt: toDateValue(value.createdAt),
            };
          })
        : [];
      return {
        id: row.id,
        organizationId: row.organizationId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        revision: row.revision,
        state: row.state,
        checksum: row.checksum,
        generatedAt: row.generatedAt,
        closeDocumentId: row.closeDocumentId,
        reopenDocumentId: row.reopenDocumentId,
        trialBalanceSummaryByCurrency,
        incomeStatementSummaryByCurrency,
        cashFlowSummaryByCurrency,
        adjustments,
        auditEvents,
        payload,
      };
    }

    const [lock] = await context.db
      .select({
        periodEnd: schema.accountingPeriodLocks.periodEnd,
        state: schema.accountingPeriodLocks.state,
        lockedByDocumentId: schema.accountingPeriodLocks.lockedByDocumentId,
      })
      .from(schema.accountingPeriodLocks)
      .where(
        and(
          eq(schema.accountingPeriodLocks.organizationId, query.organizationId),
          eq(schema.accountingPeriodLocks.periodStart, periodStart),
        ),
      )
      .limit(1);

    if (!lock) {
      throw new ValidationError(
        `No period lock found for organization ${query.organizationId} and period ${periodStart.toISOString()}`,
      );
    }

    const periodEnd = lock.periodEnd;

    const trialBalance = await listTrialBalance({
      scopeType: "book",
      counterpartyId: [],
      groupId: [],
      bookId: organizationBookIds,
      includeDescendants: true,
      attributionMode: "book_org",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
      limit: 200,
      offset: 0,
      sortBy: "accountNo",
      sortOrder: "asc",
    });

    const income = await listIncomeStatement({
      scopeType: "book",
      counterpartyId: [],
      groupId: [],
      bookId: organizationBookIds,
      includeDescendants: true,
      attributionMode: "book_org",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
    });

    const cashFlow = await listCashFlow({
      scopeType: "book",
      counterpartyId: [],
      groupId: [],
      bookId: organizationBookIds,
      includeDescendants: true,
      attributionMode: "book_org",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: periodStart.toISOString(),
      to: periodEnd.toISOString(),
      method: "direct",
    });

    const adjustments = await context.db
      .select({
        documentId: schema.documents.id,
        docType: schema.documents.docType,
        docNo: schema.documents.docNo,
        occurredAt: schema.documents.occurredAt,
        title: schema.documents.title,
      })
      .from(schema.documents)
      .where(
        and(
          or(
            eq(schema.documents.counterpartyId, query.organizationId),
            sql`${schema.documents.payload}->>'organizationId' = ${query.organizationId}`,
            sql`${schema.documents.payload}->>'sourceOrganizationId' = ${query.organizationId}`,
            sql`${schema.documents.payload}->>'destinationOrganizationId' = ${query.organizationId}`,
          ),
          sql`${schema.documents.occurredAt} >= ${periodStart}`,
          sql`${schema.documents.occurredAt} <= ${periodEnd}`,
          inArray(schema.documents.docType, [
            "accrual_adjustment",
            "revaluation_adjustment",
            "impairment_adjustment",
            "closing_reclass",
          ]),
        ),
      )
      .orderBy(schema.documents.occurredAt);

    const adjustmentIds = adjustments.map((row) => row.documentId);
    const auditEvents =
      adjustmentIds.length === 0
        ? []
        : await context.db
            .select({
              id: schema.documentEvents.id,
              eventType: schema.documentEvents.eventType,
              actorId: schema.documentEvents.actorId,
              createdAt: schema.documentEvents.createdAt,
            })
            .from(schema.documentEvents)
            .where(inArray(schema.documentEvents.documentId, adjustmentIds))
            .orderBy(schema.documentEvents.createdAt);

    const closeDocumentId = lock.lockedByDocumentId;
    if (!closeDocumentId) {
      throw new ValidationError(
        `Period lock for organization ${query.organizationId} does not reference close document`,
      );
    }

    const payload = toJsonSafeValue({
      trialBalanceSummaryByCurrency: trialBalance.summaryByCurrency,
      incomeStatementSummaryByCurrency: income.summaryByCurrency,
      cashFlowSummaryByCurrency: cashFlow.summaryByCurrency,
      adjustments,
      auditEvents,
    }) as Record<string, unknown>;

    const checksum = sha256Hex(canonicalJson(payload));

    const maxRevisionRows = await context.db
      .select({
        maxRevision:
          sql<number>`coalesce(max(${schema.accountingClosePackages.revision}), 0)::int`,
      })
      .from(schema.accountingClosePackages)
      .where(
        and(
          eq(schema.accountingClosePackages.organizationId, query.organizationId),
          eq(schema.accountingClosePackages.periodStart, periodStart),
        ),
      );
    const maxRevision = maxRevisionRows[0]?.maxRevision ?? 0;

    const [inserted] = await context.db
      .insert(schema.accountingClosePackages)
      .values({
        organizationId: query.organizationId,
        periodStart,
        periodEnd,
        revision: maxRevision + 1,
        state: lock.state === "reopened" ? "superseded" : "closed",
        closeDocumentId,
        reopenDocumentId: null,
        checksum,
        payload,
      })
      .returning();

    return {
      id: inserted!.id,
      organizationId: inserted!.organizationId,
      periodStart: inserted!.periodStart,
      periodEnd: inserted!.periodEnd,
      revision: inserted!.revision,
      state: inserted!.state,
      checksum: inserted!.checksum,
      generatedAt: inserted!.generatedAt,
      closeDocumentId: inserted!.closeDocumentId,
      reopenDocumentId: inserted!.reopenDocumentId,
      trialBalanceSummaryByCurrency: trialBalance.summaryByCurrency,
      incomeStatementSummaryByCurrency: income.summaryByCurrency,
      cashFlowSummaryByCurrency: cashFlow.summaryByCurrency,
      adjustments: adjustments.map(
        (item): ClosePackageAdjustment => ({
          documentId: item.documentId,
          docType: item.docType,
          docNo: item.docNo,
          occurredAt: item.occurredAt,
          title: item.title,
        }),
      ),
      auditEvents: auditEvents.map(
        (event): ClosePackageAuditEvent => ({
          id: event.id,
          eventType: event.eventType,
          actorId: event.actorId,
          createdAt: event.createdAt,
        }),
      ),
      payload,
    };
  };
}
