import { and, count, eq, gte, lte } from "drizzle-orm";

import type { PaginatedList } from "@bedrock/foundation/kernel/pagination";
import { schema } from "@bedrock/platform/documents/schema";

import type { DocumentsServiceContext } from "../internal/context";
import {
  buildDocumentSearchCondition,
  inArraySafe,
  resolveDocumentsSort,
} from "../internal/helpers";
import type { DocumentWithOperationId } from "../types";
import { ListDocumentsQuerySchema, type ListDocumentsQuery } from "../validation";

export function createListDocumentsQuery(context: DocumentsServiceContext) {
  const { db } = context;

  return async function listDocuments(
    input?: ListDocumentsQuery,
  ): Promise<PaginatedList<DocumentWithOperationId>> {
    const query = ListDocumentsQuerySchema.parse(input ?? {});
    const conditions = [
      buildDocumentSearchCondition(query.query),
      inArraySafe(schema.documents.docType, query.docType),
      inArraySafe(schema.documents.submissionStatus, query.submissionStatus),
      inArraySafe(schema.documents.approvalStatus, query.approvalStatus),
      inArraySafe(schema.documents.postingStatus, query.postingStatus),
      inArraySafe(schema.documents.lifecycleStatus, query.lifecycleStatus),
      inArraySafe(schema.documents.currency, query.currency),
      inArraySafe(schema.documents.counterpartyId, query.counterpartyId),
      inArraySafe(schema.documents.customerId, query.customerId),
      inArraySafe(schema.documents.operationalAccountId, query.operationalAccountId),
      query.occurredAtFrom
        ? gte(schema.documents.occurredAt, new Date(query.occurredAtFrom))
        : undefined,
      query.occurredAtTo
        ? lte(schema.documents.occurredAt, new Date(query.occurredAtTo))
        : undefined,
    ].filter(Boolean);

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
      .orderBy(resolveDocumentsSort(query.sortBy, query.sortOrder))
      .limit(query.limit)
      .offset(query.offset);

    const [totalRow] = await db
      .select({ value: count() })
      .from(schema.documents)
      .where(where);

    return {
      data: rows.map((row) => ({
        document: row.document,
        postingOperationId: row.postingOperationId ?? null,
      })),
      total: totalRow?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  };
}
