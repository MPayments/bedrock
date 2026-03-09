import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { canonicalJson, noopLogger, type Logger } from "@bedrock/common";
import {
  closeCounterpartyPeriod,
  getPreviousCalendarMonthRange,
} from "@bedrock/documents/runtime";
import { schema, type Document } from "@bedrock/documents/schema";
import { user } from "@bedrock/identity/schema";
import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/modules";
import { pgNotify } from "@bedrock/sql/drizzle";
import type { Database, Transaction } from "@bedrock/sql/ports";

import { counterparties } from "@multihansa/counterparties/schema";

function formatPeriodLabel(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 7);
}

function buildPeriodCloseIdempotencyKey(counterpartyId: string, periodStart: Date) {
  return `period_close:${counterpartyId}:${formatPeriodLabel(periodStart)}`;
}

function buildDocNo(prefix: string, documentId: string) {
  return `${prefix}-${documentId.slice(0, 8).toUpperCase()}`;
}

function toStoredJson<T>(value: T): T {
  return JSON.parse(canonicalJson(value)) as T;
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
  await tx.insert(schema.documentEvents).values({
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

  const after = input.after ?? null;
  const before = input.before ?? null;
  const docType =
    (typeof after?.docType === "string" ? after.docType : null) ??
    (typeof before?.docType === "string" ? before.docType : null);
  const version =
    (typeof after?.version === "number" ? after.version : null) ??
    (typeof before?.version === "number" ? before.version : null);

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

export interface PeriodCloseWorkerCounterpartyContext {
  counterpartyId: string;
  periodStart: Date;
  periodEnd: Date;
}

type PeriodCloseWorkerCounterpartyGuard = (
  input: PeriodCloseWorkerCounterpartyContext,
) => Promise<boolean> | boolean;

export function createIfrsPeriodCloseWorkerDefinition(deps: {
  id?: string;
  moduleId?: string;
  intervalMs?: number;
  db: Database;
  logger?: Logger;
  beforeCounterparty?: PeriodCloseWorkerCounterpartyGuard;
}): BedrockWorker {
  const { db } = deps;
  const log =
    deps.logger?.child({ svc: "ifrs-documents-period-close" }) ?? noopLogger;
  const beforeCounterparty = deps.beforeCounterparty;

  return {
    id: deps.id ?? "documents-period-close",
    moduleId: deps.moduleId ?? "ifrs-documents",
    intervalMs: deps.intervalMs ?? 60_000,
    async runOnce(context: WorkerRunContext): Promise<WorkerRunResult> {
      const { periodStart, periodEnd } = getPreviousCalendarMonthRange(context.now);
      const periodLabel = formatPeriodLabel(periodStart);
      const actorUserId = await resolveSystemActorUserId(db);

      if (!actorUserId) {
        log.warn("period close worker skipped: no user records available");
        return { processed: 0, blocked: 0 };
      }

      const rows = await db
        .select({
          id: counterparties.id,
        })
        .from(counterparties);

      let processed = 0;
      let blocked = 0;

      for (const row of rows) {
        if (context.signal.aborted) {
          break;
        }

        if (beforeCounterparty) {
          const enabled = await beforeCounterparty({
            counterpartyId: row.id,
            periodStart,
            periodEnd,
          });
          if (!enabled) {
            blocked += 1;
            continue;
          }
        }

        const created = await db.transaction(async (tx) => {
          const createIdempotencyKey = buildPeriodCloseIdempotencyKey(
            row.id,
            periodStart,
          );

          const [existing] = await tx
            .select({ id: schema.documents.id })
            .from(schema.documents)
            .where(
              and(
                eq(schema.documents.docType, "period_close"),
                eq(schema.documents.createIdempotencyKey, createIdempotencyKey),
              ),
            )
            .limit(1);

          if (existing) {
            return false;
          }

          const now = new Date();
          const id = randomUUID();
          const payload = {
            counterpartyId: row.id,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            occurredAt: periodEnd.toISOString(),
            closeReason: "auto_monthly_close",
          } as Record<string, unknown>;

          const [inserted] = await tx
            .insert(schema.documents)
            .values({
              id,
              docType: "period_close",
              docNo: buildDocNo("PCL", id),
              moduleId: "period_close",
              moduleVersion: 1,
              payloadVersion: 1,
              payload,
              title: `Period close ${periodLabel}`,
              occurredAt: periodEnd,
              submissionStatus: "submitted",
              approvalStatus: "not_required",
              postingStatus: "not_required",
              lifecycleStatus: "active",
              createIdempotencyKey,
              amountMinor: null,
              currency: null,
              memo: null,
              counterpartyId: row.id,
              customerId: null,
              organizationRequisiteId: null,
              searchText: `period_close ${periodLabel} ${row.id}`,
              createdBy: actorUserId,
              submittedBy: actorUserId,
              submittedAt: now,
              approvedBy: actorUserId,
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

          await closeCounterpartyPeriod({
            db: tx,
            counterpartyId: row.id,
            periodStart,
            periodEnd,
            closedBy: actorUserId,
            closeReason: "auto_monthly_close",
            lockedByDocumentId: inserted.id,
          });

          await insertDocumentEvent(tx, {
            documentId: inserted.id,
            eventType: "create",
            actorId: actorUserId,
            before: null,
            after: buildDocumentEventState(inserted),
            reasonMeta: {
              source: "ifrs-documents-period-close-worker",
              periodStart: periodStart.toISOString(),
              periodEnd: periodEnd.toISOString(),
            },
          });

          return true;
        });

        if (created) {
          processed += 1;
          continue;
        }

        blocked += 1;
      }

      return { processed, blocked };
    },
  };
}
