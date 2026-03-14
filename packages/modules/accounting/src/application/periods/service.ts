import { eq, sql } from "drizzle-orm";

import { canonicalJson } from "@bedrock/core/canon";
import { ValidationError } from "@bedrock/core/errors";
import type { Database, Transaction } from "@bedrock/platform-persistence";
import { sha256Hex } from "@bedrock/platform-crypto";

import {
  formatPeriodLabel,
  getPreviousCalendarMonthRange,
  normalizeMonthEndExclusive,
  normalizeMonthStart,
} from "../../domain/periods/month";
import { toJsonSafeValue } from "../../domain/reports/normalization";
import type { AccountingPeriodsRepository } from "./ports";
import { assertAccountingOrganizationIsInternal } from "../../infra/organizations/internal-ledger";
import { createDrizzleAccountingPeriodsRepository } from "../../infra/drizzle/repositories/accounting-repository";
import { createAccountingReportQueriesService } from "../reports/report-service";
import { schema as reportingSchema } from "../../infra/reporting/query-support/shared";

type Queryable = Database | Transaction;

export interface AccountingPeriodsServiceDeps {
  db: Database;
}

export type AccountingPeriodsService = ReturnType<
  typeof createAccountingPeriodsService
>;

function resolveQueryable(input: {
  db: Database;
  override?: Queryable;
}): Queryable {
  return input.override ?? input.db;
}

function createPeriodsRepository(input: {
  db: Database;
  override?: Queryable;
}): AccountingPeriodsRepository {
  return createDrizzleAccountingPeriodsRepository(resolveQueryable(input));
}

async function buildClosePackageSnapshot(input: {
  db: Queryable;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  closeDocumentId: string;
}) {
  await assertAccountingOrganizationIsInternal({
    db: input.db,
    organizationId: input.organizationId,
  });

  const organizationBooks = await input.db
    .select({ id: reportingSchema.books.id })
    .from(reportingSchema.books)
    .where(eq(reportingSchema.books.ownerId, input.organizationId));

  if (organizationBooks.length === 0) {
    throw new ValidationError(
      `No internal-ledger books found for organization ${input.organizationId}`,
    );
  }

  const organizationBookIds = organizationBooks.map((row) => row.id);
  const reports = createAccountingReportQueriesService({ db: input.db });

  const [trialBalance, incomeStatement, cashFlow] = await Promise.all([
    reports.listTrialBalance({
      scopeType: "book",
      counterpartyId: [],
      groupId: [],
      bookId: organizationBookIds,
      includeDescendants: true,
      attributionMode: "book_org",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: input.periodStart.toISOString(),
      to: input.periodEnd.toISOString(),
      limit: 200,
      offset: 0,
      sortBy: "accountNo",
      sortOrder: "asc",
    }),
    reports.listIncomeStatement({
      scopeType: "book",
      counterpartyId: [],
      groupId: [],
      bookId: organizationBookIds,
      includeDescendants: true,
      attributionMode: "book_org",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: input.periodStart.toISOString(),
      to: input.periodEnd.toISOString(),
    }),
    reports.listCashFlow({
      scopeType: "book",
      counterpartyId: [],
      groupId: [],
      bookId: organizationBookIds,
      includeDescendants: true,
      attributionMode: "book_org",
      includeUnattributed: false,
      currency: undefined,
      status: ["posted"],
      from: input.periodStart.toISOString(),
      to: input.periodEnd.toISOString(),
      method: "direct",
    }),
  ]);

  const adjustmentsResult = await input.db.execute(sql`
    SELECT
      id::text AS document_id,
      doc_type,
      doc_no,
      occurred_at,
      title
    FROM "documents"
    WHERE (
      counterparty_id = ${input.organizationId}::uuid
      OR payload->>'organizationId' = ${input.organizationId}
      OR payload->>'sourceOrganizationId' = ${input.organizationId}
      OR payload->>'destinationOrganizationId' = ${input.organizationId}
    )
      AND occurred_at >= ${input.periodStart}
      AND occurred_at <= ${input.periodEnd}
      AND doc_type IN (${sql.join(
        [
          "accrual_adjustment",
          "revaluation_adjustment",
          "impairment_adjustment",
          "closing_reclass",
        ].map((docType) => sql`${docType}`),
        sql`, `,
      )})
    ORDER BY occurred_at
  `);
  const adjustments = (adjustmentsResult.rows ?? []) as {
    document_id: string;
    doc_type: string;
    doc_no: string;
    occurred_at: Date;
    title: string;
  }[];

  const adjustmentIds = adjustments.map((row) => row.document_id);
  const auditEventsResult =
    adjustmentIds.length === 0
      ? { rows: [] }
      : await input.db.execute(sql`
          SELECT
            id::text AS id,
            event_type,
            actor_id,
            created_at
          FROM "document_events"
          WHERE document_id IN (${sql.join(
            adjustmentIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})
          ORDER BY created_at
        `);
  const auditEvents = (auditEventsResult.rows ?? []) as {
    id: string;
    event_type: string;
    actor_id: string | null;
    created_at: Date;
  }[];

  const payload = toJsonSafeValue({
    trialBalanceSummaryByCurrency: trialBalance.summaryByCurrency,
    incomeStatementSummaryByCurrency: incomeStatement.summaryByCurrency,
    cashFlowSummaryByCurrency: cashFlow.summaryByCurrency,
    adjustments: adjustments.map((row) => ({
      documentId: row.document_id,
      docType: row.doc_type,
      docNo: row.doc_no,
      occurredAt: row.occurred_at,
      title: row.title,
    })),
    auditEvents: auditEvents.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      actorId: row.actor_id,
      createdAt: row.created_at,
    })),
  }) as Record<string, unknown>;

  const checksum = sha256Hex(canonicalJson(payload));

  const repository = createDrizzleAccountingPeriodsRepository(input.db);
  const revision =
    (await repository.findMaxClosePackageRevision({
      organizationId: input.organizationId,
      periodStart: input.periodStart,
    })) + 1;

  return repository.insertClosePackage({
    organizationId: input.organizationId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    revision,
    state: "closed",
    closeDocumentId: input.closeDocumentId,
    reopenDocumentId: null,
    checksum,
    payload,
  });
}

export function createAccountingPeriodsService(deps: AccountingPeriodsServiceDeps) {
  async function isOrganizationPeriodClosed(input: {
    db?: Queryable;
    organizationId: string;
    occurredAt: Date;
  }): Promise<boolean> {
    const repository = createPeriodsRepository({ db: deps.db, override: input.db });
    const periodStart = normalizeMonthStart(input.occurredAt);
    return Boolean(
      await repository.findClosedPeriodLock({
        organizationId: input.organizationId,
        periodStart,
      }),
    );
  }

  async function assertOrganizationPeriodsOpen(input: {
    db?: Queryable;
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }): Promise<void> {
    if (input.organizationIds.length === 0) {
      return;
    }

    const queryable = resolveQueryable({ db: deps.db, override: input.db });
    const periodStart = normalizeMonthStart(input.occurredAt);
    const periodLabel = formatPeriodLabel(periodStart);

    for (const organizationId of input.organizationIds) {
      const closed = await isOrganizationPeriodClosed({
        db: queryable,
        organizationId,
        occurredAt: input.occurredAt,
      });
      if (!closed) {
        continue;
      }

      throw new ValidationError(
        `Accounting period ${periodLabel} is closed for organization ${organizationId}; ${input.docType} cannot be mutated`,
      );
    }
  }

  async function closePeriod(input: {
    db?: Queryable;
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
  }) {
    const queryable = resolveQueryable({ db: deps.db, override: input.db });
    const repository = createDrizzleAccountingPeriodsRepository(queryable);
    const periodStart = normalizeMonthStart(input.periodStart);
    const periodEnd = normalizeMonthEndExclusive(input.periodEnd);

    const lock = await repository.upsertClosedPeriodLock({
      organizationId: input.organizationId,
      periodStart,
      periodEnd,
      closeDocumentId: input.closeDocumentId,
      closeReason: input.closeReason ?? null,
      closedBy: input.closedBy,
      closedAt: new Date(),
    });

    const closePackage = await buildClosePackageSnapshot({
      db: queryable,
      organizationId: input.organizationId,
      periodStart,
      periodEnd,
      closeDocumentId: input.closeDocumentId,
    });

    return {
      lock,
      closePackage,
    };
  }

  async function reopenPeriod(input: {
    db?: Queryable;
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
  }) {
    const queryable = resolveQueryable({ db: deps.db, override: input.db });
    const repository = createDrizzleAccountingPeriodsRepository(queryable);
    const periodStart = normalizeMonthStart(input.periodStart);

    const lock = await repository.upsertReopenedPeriodLock({
      organizationId: input.organizationId,
      periodStart,
      periodEnd: normalizeMonthEndExclusive(periodStart),
      reopenedBy: input.reopenedBy,
      reopenReason: input.reopenReason ?? null,
      reopenedAt: new Date(),
    });

    const latestClosePackage = await repository.findLatestClosePackage({
      organizationId: input.organizationId,
      periodStart,
    });

    if (latestClosePackage) {
      await repository.markClosePackageSuperseded({
        id: latestClosePackage.id,
        reopenDocumentId: input.reopenDocumentId ?? null,
      });
    }

    return lock;
  }

  return {
    assertOrganizationPeriodsOpen,
    closePeriod,
    isOrganizationPeriodClosed,
    reopenPeriod,
  };
}

export { getPreviousCalendarMonthRange };
