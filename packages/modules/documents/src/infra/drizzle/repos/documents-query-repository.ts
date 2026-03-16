import { and, count, eq, inArray, type SQL, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";
import { dedupeIds } from "@bedrock/shared/core/domain";

import type { DocumentsQueryRepository } from "../../../application/documents/ports";
import type { ListDocumentsQuery } from "../../../contracts/queries";
import { buildDocumentSearchCondition, inArraySafe, resolveDocumentsSort } from "../query-helpers";
import { schema } from "../schema";

export function createDrizzleDocumentsQueryRepository(
  db: Database | Transaction,
): DocumentsQueryRepository {
  return {
    async findDocumentByType(input) {
      const [document] = await db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.id, input.documentId),
            eq(schema.documents.docType, input.docType),
          ),
        )
        .limit(1);

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
    async listDocumentsByIds(documentIds) {
      const uniqueDocumentIds = dedupeIds(documentIds);
      if (uniqueDocumentIds.length === 0) {
        return [];
      }

      return db
        .select()
        .from(schema.documents)
        .where(inArray(schema.documents.id, uniqueDocumentIds));
    },
  };
}
