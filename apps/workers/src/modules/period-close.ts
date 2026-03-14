import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { createAccountingPeriodsService } from "@bedrock/accounting/periods";
import { canonicalJson } from "@bedrock/shared/core/canon";
import type { BedrockWorker } from "@bedrock/platform/worker-runtime";
import { schema as documentsSchema, type Document } from "@bedrock/documents/schema";
import { user } from "@bedrock/platform/auth-model/schema";
import type { Logger } from "@bedrock/platform/observability/logger";
import { listInternalLedgerOrganizations } from "@bedrock/organizations";
import type { Database, Transaction } from "@bedrock/platform/persistence/drizzle";
import { pgNotify } from "@bedrock/platform/persistence/notify";
import {
  createPeriodCloseWorkerRunner,
  type PeriodCloseWorkerOrganizationContext,
} from "@bedrock/workflow-period-close";

function buildDocNo(prefix: string, documentId: string) {
  return `${prefix}-${documentId.slice(0, 8).toUpperCase()}`;
}

function buildPeriodCloseIdempotencyKey(organizationId: string, periodStart: Date) {
  return `period_close:${organizationId}:${periodStart.toISOString().slice(0, 7)}`;
}

function toStoredJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
}

function readRecordStringField(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function readRecordIntField(
  record: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function buildDocumentEventState(document: Document) {
  return {
    id: document.id,
    docType: document.docType,
    docNo: document.docNo,
    moduleId: document.moduleId,
    moduleVersion: document.moduleVersion,
    payloadVersion: document.payloadVersion,
    title: document.title,
    occurredAt: document.occurredAt,
    submissionStatus: document.submissionStatus,
    approvalStatus: document.approvalStatus,
    postingStatus: document.postingStatus,
    lifecycleStatus: document.lifecycleStatus,
    amountMinor: document.amountMinor,
    currency: document.currency,
    memo: document.memo,
    version: document.version,
    postingError: document.postingError,
    postingStartedAt: document.postingStartedAt,
    postedAt: document.postedAt,
    updatedAt: document.updatedAt,
  };
}

async function insertDocumentEvent(
  tx: Transaction,
  input: {
    documentId: string;
    eventType: string;
    actorId?: string | null;
    reasonMeta?: Record<string, unknown> | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
) {
  await tx.insert(documentsSchema.documentEvents).values({
    documentId: input.documentId,
    eventType: input.eventType,
    actorId: input.actorId ?? null,
    requestId: null,
    correlationId: null,
    traceId: null,
    causationId: null,
    reasonCode: null,
    reasonMeta: input.reasonMeta ? toStoredJson(input.reasonMeta) : null,
    before: input.before ? toStoredJson(input.before) : null,
    after: input.after ? toStoredJson(input.after) : null,
  });

  const docType =
    readRecordStringField(input.after, "docType") ??
    readRecordStringField(input.before, "docType");
  const version =
    readRecordIntField(input.after, "version") ??
    readRecordIntField(input.before, "version");

  await pgNotify(
    tx,
    "document_changed",
    JSON.stringify({
      documentId: input.documentId,
      docType,
      version,
      eventType: input.eventType,
    }),
  );
}

async function resolveSystemActorUserId(db: Database): Promise<string | null> {
  const [admin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .orderBy(asc(user.createdAt))
    .limit(1);

  if (admin) {
    return admin.id;
  }

  const [fallback] = await db
    .select({ id: user.id })
    .from(user)
    .orderBy(asc(user.createdAt))
    .limit(1);

  return fallback?.id ?? null;
}

async function listOrganizationIds(db: Database): Promise<string[]> {
  const rows = await listInternalLedgerOrganizations(db);
  return rows.map((row) => row.id);
}

async function createPeriodCloseForOrganization(input: {
  db: Database;
  actorUserId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}): Promise<boolean> {
  const accountingPeriods = createAccountingPeriodsService({ db: input.db });

  return input.db.transaction(async (tx) => {
    const createIdempotencyKey = buildPeriodCloseIdempotencyKey(
      input.organizationId,
      input.periodStart,
    );

    const [existing] = await tx
      .select({ id: documentsSchema.documents.id })
      .from(documentsSchema.documents)
      .where(
        and(
          eq(documentsSchema.documents.docType, "period_close"),
          eq(documentsSchema.documents.createIdempotencyKey, createIdempotencyKey),
        ),
      )
      .limit(1);

    if (existing) {
      return false;
    }

    const now = new Date();
    const id = randomUUID();
    const payload = {
      organizationId: input.organizationId,
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
      occurredAt: input.periodEnd.toISOString(),
      closeReason: "auto_monthly_close",
    } as Record<string, unknown>;

    const [inserted] = await tx
      .insert(documentsSchema.documents)
      .values({
        id,
        docType: "period_close",
        docNo: buildDocNo("PCL", id),
        moduleId: "period_close",
        moduleVersion: 1,
        payloadVersion: 1,
        payload,
        title: `Period close ${input.periodLabel}`,
        occurredAt: input.periodEnd,
        submissionStatus: "submitted",
        approvalStatus: "not_required",
        postingStatus: "not_required",
        lifecycleStatus: "active",
        createIdempotencyKey,
        amountMinor: null,
        currency: null,
        memo: null,
        counterpartyId: null,
        customerId: null,
        organizationRequisiteId: null,
        searchText: `period_close ${input.periodLabel} ${input.organizationId}`,
        createdBy: input.actorUserId,
        submittedBy: input.actorUserId,
        submittedAt: now,
        approvedBy: input.actorUserId,
        approvedAt: now,
        rejectedBy: null,
        rejectedAt: null,
        cancelledBy: null,
        cancelledAt: null,
        postingStartedAt: null,
        postedAt: null,
        postingError: null,
        createdAt: now,
        updatedAt: now,
        version: 1,
      })
      .onConflictDoNothing()
      .returning();

    if (!inserted) {
      return false;
    }

    await accountingPeriods.closePeriod({
      db: tx,
      organizationId: input.organizationId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      closedBy: input.actorUserId,
      closeReason: "auto_monthly_close",
      closeDocumentId: inserted.id,
    });

    await insertDocumentEvent(tx, {
      documentId: inserted.id,
      eventType: "create",
      actorId: input.actorUserId,
      before: null,
      after: buildDocumentEventState(inserted),
      reasonMeta: {
        source: "documents-period-close-worker",
        periodStart: input.periodStart.toISOString(),
        periodEnd: input.periodEnd.toISOString(),
      },
    });

    return true;
  });
}

export function createPeriodCloseWorkerDefinition(deps: {
  id: string;
  intervalMs: number;
  db: Database;
  logger?: Logger;
  beforeOrganization?: (
    input: PeriodCloseWorkerOrganizationContext,
  ) => Promise<boolean> | boolean;
}): BedrockWorker {
  const runOnce = createPeriodCloseWorkerRunner({
    logger: deps.logger,
    beforeOrganization: deps.beforeOrganization,
    resolveSystemActorUserId: () => resolveSystemActorUserId(deps.db),
    listOrganizationIds: () => listOrganizationIds(deps.db),
    createPeriodCloseForOrganization: (input) =>
      createPeriodCloseForOrganization({
        db: deps.db,
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        periodLabel: input.periodLabel,
      }),
  });

  return {
    id: deps.id,
    intervalMs: deps.intervalMs,
    runOnce,
  };
}
