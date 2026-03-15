import { and, count, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import { pgNotify } from "@bedrock/platform/persistence/notify";

import { insertInitialLinks } from "./graph";
import { inArraySafe, buildDocumentSearchCondition, resolveDocumentsSort } from "./query-helpers";
import { schema } from "./schema";
import { toStoredJson } from "./stored-json";
import type {
  DocumentsRepository,
  DocumentsRepositoryEventInput,
} from "../../application/ports";
import type { ListDocumentsQuery } from "../../contracts/validation";

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

export function createDrizzleDocumentsRepository(
  db: Queryable,
): DocumentsRepository {
  return {
    async findDocumentByType(input) {
      const selection = db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.id, input.documentId),
            eq(schema.documents.docType, input.docType),
          ),
        )
        .limit(1);
      const [document] = input.forUpdate
        ? await selection.for("update")
        : await selection;

      return document ?? null;
    },
    async findDocumentWithPostingOperation(input) {
      const [row] = await db
        .select({
          document: schema.documents,
          postingOperationId: schema.documentOperations.operationId,
        })
        .from(schema.documents)
        .leftJoin(
          schema.documentOperations,
          and(
            eq(schema.documentOperations.documentId, schema.documents.id),
            eq(schema.documentOperations.kind, "post"),
          ),
        )
        .where(
          and(
            eq(schema.documents.id, input.documentId),
            eq(schema.documents.docType, input.docType),
          ),
        )
        .limit(1);

      return row
        ? {
            document: row.document,
            postingOperationId: row.postingOperationId ?? null,
          }
        : null;
    },
    async findDocumentByCreateIdempotencyKey(input) {
      const [document] = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.docType, input.docType),
            eq(
              schema.documents.createIdempotencyKey,
              input.createIdempotencyKey,
            ),
          ),
        )
        .limit(1);

      return document ?? null;
    },
    async findPostingOperationId(input) {
      const [row] = await db
        .select({ operationId: schema.documentOperations.operationId })
        .from(schema.documentOperations)
        .where(
          and(
            eq(schema.documentOperations.documentId, input.documentId),
            eq(schema.documentOperations.kind, "post"),
          ),
        )
        .limit(1);

      return row?.operationId ?? null;
    },
    async insertDocument(document) {
      const [inserted] = await db
        .insert(schema.documents)
        .values(document)
        .onConflictDoNothing()
        .returning();

      return inserted ?? null;
    },
    async updateDocument(input) {
      const [updated] = await db
        .update(schema.documents)
        .set({
          ...input.patch,
          updatedAt: new Date(),
          version: sql`${schema.documents.version} + 1`,
        })
        .where(
          and(
            eq(schema.documents.id, input.documentId),
            eq(schema.documents.docType, input.docType),
          ),
        )
        .returning();

      return updated ?? null;
    },
    async insertDocumentOperation(input) {
      await db
        .insert(schema.documentOperations)
        .values({
          documentId: input.documentId,
          operationId: input.operationId,
          kind: input.kind,
        })
        .onConflictDoNothing();
    },
    async resetPostingOperation(input) {
      await db
        .update(schema.ledgerOperations)
        .set({
          status: "pending",
          error: null,
          postedAt: null,
        })
        .where(eq(schema.ledgerOperations.id, input.operationId));

      await db
        .update(schema.tbTransferPlans)
        .set({
          status: "pending",
          error: null,
        })
        .where(eq(schema.tbTransferPlans.operationId, input.operationId));

      await db
        .update(schema.outbox)
        .set({
          status: "pending",
          error: null,
          lockedAt: null,
          availableAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.outbox.kind, "post_operation"),
            eq(schema.outbox.refId, input.operationId),
          ),
        );
    },
    async insertDocumentEvent(input: DocumentsRepositoryEventInput) {
      await db.insert(schema.documentEvents).values({
        documentId: input.documentId,
        eventType: input.eventType,
        actorId: input.actorId ?? null,
        requestId: input.requestId ?? null,
        correlationId: input.correlationId ?? null,
        traceId: input.traceId ?? null,
        causationId: input.causationId ?? null,
        reasonCode: input.reasonCode ?? null,
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
        db,
        "document_changed",
        JSON.stringify({
          documentId: input.documentId,
          docType,
          version,
          eventType: input.eventType,
        }),
      );
    },
    async insertInitialLinks(input) {
      await insertInitialLinks(db as Transaction, input.document, input.links);
    },
    async listDocuments(input: ListDocumentsQuery) {
      const conditions = [
        buildDocumentSearchCondition(input.query),
        inArraySafe(schema.documents.docType, input.docType),
        inArraySafe(schema.documents.submissionStatus, input.submissionStatus),
        inArraySafe(schema.documents.approvalStatus, input.approvalStatus),
        inArraySafe(schema.documents.postingStatus, input.postingStatus),
        inArraySafe(schema.documents.lifecycleStatus, input.lifecycleStatus),
        inArraySafe(schema.documents.currency, input.currency),
        inArraySafe(schema.documents.counterpartyId, input.counterpartyId),
        inArraySafe(schema.documents.customerId, input.customerId),
        inArraySafe(
          schema.documents.organizationRequisiteId,
          input.organizationRequisiteId,
        ),
        input.occurredAtFrom
          ? sql`${schema.documents.occurredAt} >= ${new Date(input.occurredAtFrom)}`
          : undefined,
        input.occurredAtTo
          ? sql`${schema.documents.occurredAt} <= ${new Date(input.occurredAtTo)}`
          : undefined,
      ].filter(Boolean) as SQL[];
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          document: schema.documents,
          postingOperationId: schema.documentOperations.operationId,
        })
        .from(schema.documents)
        .leftJoin(
          schema.documentOperations,
          and(
            eq(schema.documentOperations.documentId, schema.documents.id),
            eq(schema.documentOperations.kind, "post"),
          ),
        )
        .where(where)
        .orderBy(resolveDocumentsSort(input.sortBy, input.sortOrder))
        .limit(input.limit)
        .offset(input.offset);

      const [totalRow] = await db
        .select({ value: count() })
        .from(schema.documents)
        .where(where);

      return {
        rows: rows.map((row) => ({
          document: row.document,
          postingOperationId: row.postingOperationId ?? null,
        })),
        total: totalRow?.value ?? 0,
      };
    },
    async listDocumentLinks(documentId) {
      return db
        .select()
        .from(schema.documentLinks)
        .where(
          or(
            eq(schema.documentLinks.fromDocumentId, documentId),
            eq(schema.documentLinks.toDocumentId, documentId),
          ),
        );
    },
    async listDocumentsByIds(documentIds) {
      const uniqueDocumentIds = Array.from(new Set(documentIds.filter(Boolean)));
      if (uniqueDocumentIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(schema.documents)
        .where(inArray(schema.documents.id, uniqueDocumentIds));
    },
    async listDocumentOperations(documentId) {
      return db
        .select()
        .from(schema.documentOperations)
        .where(eq(schema.documentOperations.documentId, documentId));
    },
    async listDocumentEvents(documentId) {
      return db
        .select()
        .from(schema.documentEvents)
        .where(eq(schema.documentEvents.documentId, documentId))
        .orderBy(schema.documentEvents.createdAt);
    },
    async findDocumentSnapshot(documentId) {
      const [snapshot] = await db
        .select()
        .from(schema.documentSnapshots)
        .where(eq(schema.documentSnapshots.documentId, documentId))
        .limit(1);

      return snapshot ?? null;
    },
    async getLatestPostingArtifacts(documentId) {
      const [row] = await db
        .select({ reasonMeta: schema.documentEvents.reasonMeta })
        .from(schema.documentEvents)
        .where(
          and(
            eq(schema.documentEvents.documentId, documentId),
            eq(schema.documentEvents.eventType, "post"),
          ),
        )
        .orderBy(desc(schema.documentEvents.createdAt))
        .limit(1);

      return (row?.reasonMeta as Record<string, unknown> | null) ?? null;
    },
  };
}
