import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/core/documents/schema";
import type { Database } from "@bedrock/kernel/db/types";

import type { BedrockWorker, WorkerRunContext, WorkerRunResult } from "../worker-runtime";
import {
  buildDocumentEventState,
  getLatestPostingArtifacts,
  insertDocumentEvent,
} from "./internal/helpers";

export interface DocumentsWorkerItemContext {
  documentId: string;
  operationId: string;
  moduleId: string;
  bookIds: string[];
}

type DocumentsWorkerItemGuard = (
  input: DocumentsWorkerItemContext,
) => Promise<boolean> | boolean;

async function listOperationBookIds(
  db: Database,
  operationIds: string[],
): Promise<Map<string, string[]>> {
  if (operationIds.length === 0) {
    return new Map();
  }

  const result = await db.execute(sql`
    SELECT DISTINCT
      operation_id::text AS operation_id,
      book_id::text AS book_id
    FROM ${schema.postings}
    WHERE operation_id IN (${sql.join(operationIds.map((id) => sql`${id}::uuid`), sql`, `)})
  `);
  const rows = (result.rows ?? []) as {
    operation_id: string;
    book_id: string;
  }[];

  const byOperation = new Map<string, Set<string>>();
  for (const row of rows) {
    const bucket = byOperation.get(row.operation_id) ?? new Set<string>();
    bucket.add(row.book_id);
    byOperation.set(row.operation_id, bucket);
  }

  return new Map(
    [...byOperation.entries()].map(([operationId, bookIds]) => [
      operationId,
      [...bookIds],
    ]),
  );
}

export function createDocumentsWorkerDefinition(deps: {
  id?: string;
  moduleId?: string;
  intervalMs?: number;
  db: Database;
  beforeDocument?: DocumentsWorkerItemGuard;
  batchSize?: number;
}): BedrockWorker {
  const { db } = deps;
  const beforeDocument = deps.beforeDocument;
  const batchSize = deps.batchSize ?? 50;

  async function runPass() {
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: schema.documents.id,
          docType: schema.documents.docType,
          docNo: schema.documents.docNo,
          moduleId: schema.documents.moduleId,
          moduleVersion: schema.documents.moduleVersion,
          payload: schema.documents.payload,
          payloadVersion: schema.documents.payloadVersion,
          title: schema.documents.title,
          occurredAt: schema.documents.occurredAt,
          submissionStatus: schema.documents.submissionStatus,
          approvalStatus: schema.documents.approvalStatus,
          postingStatus: schema.documents.postingStatus,
          lifecycleStatus: schema.documents.lifecycleStatus,
          amountMinor: schema.documents.amountMinor,
          currency: schema.documents.currency,
          memo: schema.documents.memo,
          createdBy: schema.documents.createdBy,
          submittedBy: schema.documents.submittedBy,
          submittedAt: schema.documents.submittedAt,
          approvedBy: schema.documents.approvedBy,
          approvedAt: schema.documents.approvedAt,
          rejectedBy: schema.documents.rejectedBy,
          rejectedAt: schema.documents.rejectedAt,
          cancelledBy: schema.documents.cancelledBy,
          cancelledAt: schema.documents.cancelledAt,
          postingStartedAt: schema.documents.postingStartedAt,
          postedAtDocument: schema.documents.postedAt,
          postingErrorDocument: schema.documents.postingError,
          createIdempotencyKey: schema.documents.createIdempotencyKey,
          searchText: schema.documents.searchText,
          counterpartyId: schema.documents.counterpartyId,
          customerId: schema.documents.customerId,
          counterpartyAccountId: schema.documents.counterpartyAccountId,
          createdAt: schema.documents.createdAt,
          updatedAt: schema.documents.updatedAt,
          version: schema.documents.version,
          operationId: schema.documentOperations.operationId,
          ledgerStatus: schema.ledgerOperations.status,
          postedAt: schema.ledgerOperations.postedAt,
          error: schema.ledgerOperations.error,
        })
        .from(schema.documents)
        .innerJoin(
          schema.documentOperations,
          and(
            eq(schema.documentOperations.documentId, schema.documents.id),
            eq(schema.documentOperations.kind, "post"),
          ),
        )
        .innerJoin(
          schema.ledgerOperations,
          eq(schema.ledgerOperations.id, schema.documentOperations.operationId),
        )
        .where(eq(schema.documents.postingStatus, "posting"))
        .for("update", { skipLocked: true })
        .limit(batchSize);

      return rows;
    });
    const operationBookIds = await listOperationBookIds(
      db,
      claimed.map((row) => row.operationId),
    );

    let finalized = 0;

    for (const row of claimed) {
      if (row.ledgerStatus !== "posted" && row.ledgerStatus !== "failed") {
        continue;
      }

      if (beforeDocument) {
        const isEnabled = await beforeDocument({
          documentId: row.id,
          operationId: row.operationId,
          moduleId: row.moduleId,
          bookIds: operationBookIds.get(row.operationId) ?? [],
        });
        if (!isEnabled) {
          continue;
        }
      }

      await db.transaction(async (tx) => {
        const before = buildDocumentEventState({
          id: row.id,
          docType: row.docType,
          docNo: row.docNo,
          moduleId: row.moduleId,
          moduleVersion: row.moduleVersion,
          payloadVersion: row.payloadVersion,
          payload: row.payload,
          title: row.title,
          occurredAt: row.occurredAt,
          submissionStatus: row.submissionStatus,
          approvalStatus: row.approvalStatus,
          postingStatus: row.postingStatus,
          lifecycleStatus: row.lifecycleStatus,
          createIdempotencyKey: row.createIdempotencyKey,
          amountMinor: row.amountMinor,
          currency: row.currency,
          memo: row.memo,
          counterpartyId: row.counterpartyId,
          customerId: row.customerId,
          counterpartyAccountId: row.counterpartyAccountId,
          searchText: row.searchText,
          createdBy: row.createdBy,
          submittedBy: row.submittedBy,
          submittedAt: row.submittedAt,
          approvedBy: row.approvedBy,
          approvedAt: row.approvedAt,
          rejectedBy: row.rejectedBy,
          rejectedAt: row.rejectedAt,
          cancelledBy: row.cancelledBy,
          cancelledAt: row.cancelledAt,
          postingStartedAt: row.postingStartedAt,
          postedAt: row.postedAtDocument,
          postingError: row.postingErrorDocument,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          version: row.version,
        });

        const [updated] = await tx
          .update(schema.documents)
          .set({
            postingStatus: row.ledgerStatus === "posted" ? "posted" : "failed",
            postedAt:
              row.ledgerStatus === "posted" ? (row.postedAt ?? new Date()) : null,
            postingError: row.ledgerStatus === "failed" ? row.error : null,
            updatedAt: sql`now()`,
            version: sql`${schema.documents.version} + 1`,
          })
          .where(
            and(
              eq(schema.documents.id, row.id),
              eq(schema.documents.postingStatus, "posting"),
            ),
          )
          .returning();

        if (!updated) {
          return;
        }

        if (row.ledgerStatus === "posted") {
          const [existingSnapshot] = await tx
            .select({ id: schema.documentSnapshots.id })
            .from(schema.documentSnapshots)
            .where(eq(schema.documentSnapshots.documentId, row.id))
            .limit(1);

          if (!existingSnapshot) {
            const artifacts = await getLatestPostingArtifacts(tx, row.id);
            if (artifacts) {
              await tx.insert(schema.documentSnapshots).values({
                documentId: updated.id,
                payload: updated.payload,
                payloadVersion: updated.payloadVersion,
                moduleId: updated.moduleId,
                moduleVersion: updated.moduleVersion,
                packChecksum: String(artifacts.packChecksum ?? ""),
                postingPlanChecksum: String(artifacts.postingPlanChecksum ?? ""),
                journalIntentChecksum: String(artifacts.journalIntentChecksum ?? ""),
                postingPlan: (artifacts.postingPlan ??
                  {}) as Record<string, unknown>,
                journalIntent: (artifacts.journalIntent ??
                  {}) as Record<string, unknown>,
                resolvedTemplates: Array.isArray(artifacts.resolvedTemplates)
                  ? artifacts.resolvedTemplates
                  : null,
              });
            }
          }
        }

        await insertDocumentEvent(tx, {
          documentId: updated.id,
          eventType: row.ledgerStatus === "posted" ? "posted" : "posting_failed",
          before,
          after: buildDocumentEventState(updated),
          reasonMeta:
            row.ledgerStatus === "failed"
              ? { operationId: row.operationId, error: row.error }
              : { operationId: row.operationId },
        });

        finalized += 1;
      });
    }

    return finalized;
  }

  async function runOnce(_ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await runPass();
    return { processed };
  }

  return {
    id: deps.id ?? "documents",
    moduleId: deps.moduleId ?? "documents",
    intervalMs: deps.intervalMs ?? 5_000,
    runOnce,
  };
}
