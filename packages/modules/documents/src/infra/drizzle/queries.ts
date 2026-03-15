import { and, eq, inArray, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "./schema";
import type { DocumentsReadModel } from "../../contracts/read-model";

export function createDrizzleDocumentsReadModel(input: {
  db: Queryable;
}): DocumentsReadModel {
  const { db } = input;

  return {
    async getDocumentByType(query) {
      const selection = db
        .select()
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.id, query.documentId),
            eq(schema.documents.docType, query.docType),
          ),
        )
        .limit(1);
      const [document] = query.forUpdate
        ? await selection.for("update")
        : await selection;

      return document ?? null;
    },
    async findIncomingLinkedDocument(query) {
      const [row] = await db
        .select({
          document: schema.documents,
        })
        .from(schema.documentLinks)
        .innerJoin(
          schema.documents,
          eq(schema.documents.id, schema.documentLinks.fromDocumentId),
        )
        .where(
          and(
            eq(schema.documentLinks.toDocumentId, query.toDocumentId),
            eq(schema.documentLinks.linkType, query.linkType),
            eq(schema.documents.docType, query.fromDocType),
          ),
        )
        .limit(1);

      return row?.document ?? null;
    },
    async getDocumentOperationId(query) {
      const [row] = await db
        .select({
          operationId: schema.documentOperations.operationId,
        })
        .from(schema.documentOperations)
        .where(
          and(
            eq(schema.documentOperations.documentId, query.documentId),
            eq(schema.documentOperations.kind, query.kind),
          ),
        )
        .limit(1);

      return row?.operationId ?? null;
    },
    async listDocumentLabelsById(ids: string[]) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await db
        .select({
          id: schema.documents.id,
          docType: schema.documents.docType,
          docNo: schema.documents.docNo,
          title: schema.documents.title,
        })
        .from(schema.documents)
        .where(inArray(schema.documents.id, uniqueIds));

      return new Map(
        rows.map((row) => [
          row.id,
          `${row.docType} ${row.docNo}${row.title ? ` · ${row.title}` : ""}`,
        ]),
      );
    },
    async findDocumentIdByCreateIdempotencyKey(query) {
      const [row] = await db
        .select({ id: schema.documents.id })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.docType, query.docType),
            eq(
              schema.documents.createIdempotencyKey,
              query.createIdempotencyKey,
            ),
          ),
        )
        .limit(1);

      return row?.id ?? null;
    },
    async listOperationDocumentRefs(operationIds: string[]) {
      const uniqueOperationIds = Array.from(new Set(operationIds.filter(Boolean)));
      if (uniqueOperationIds.length === 0) {
        return new Map();
      }

      const rows = await db
        .select({
          operationId: schema.documentOperations.operationId,
          documentId: schema.documents.id,
          documentType: schema.documents.docType,
          channel: sql<string | null>`coalesce(${schema.documents.payload}->>'channel', ${schema.documents.docType})`,
        })
        .from(schema.documentOperations)
        .innerJoin(
          schema.documents,
          eq(schema.documents.id, schema.documentOperations.documentId),
        )
        .where(inArray(schema.documentOperations.operationId, uniqueOperationIds));

      return new Map(
        rows.map((row) => [
          row.operationId,
          {
            operationId: row.operationId,
            documentId: row.documentId,
            documentType: row.documentType,
            channel: row.channel,
          },
        ]),
      );
    },
    async listAdjustmentsForOrganizationPeriod(query) {
      const result = await db.execute(sql`
        SELECT
          id::text AS document_id,
          doc_type,
          doc_no,
          occurred_at,
          title
        FROM "documents"
        WHERE (
          counterparty_id = ${query.organizationId}::uuid
          OR payload->>'organizationId' = ${query.organizationId}
          OR payload->>'sourceOrganizationId' = ${query.organizationId}
          OR payload->>'destinationOrganizationId' = ${query.organizationId}
        )
          AND occurred_at >= ${query.periodStart}
          AND occurred_at <= ${query.periodEnd}
          AND doc_type IN (${sql.join(
            query.docTypes.map((docType) => sql`${docType}`),
            sql`, `,
          )})
        ORDER BY occurred_at
      `);

      return ((result.rows ?? []) as {
        document_id: string;
        doc_type: string;
        doc_no: string;
        occurred_at: Date;
        title: string;
      }[]).map((row) => ({
        documentId: row.document_id,
        docType: row.doc_type,
        docNo: row.doc_no,
        occurredAt: row.occurred_at,
        title: row.title,
      }));
    },
    async listAuditEventsByDocumentId(documentIds: string[]) {
      const uniqueDocumentIds = Array.from(new Set(documentIds.filter(Boolean)));
      if (uniqueDocumentIds.length === 0) {
        return [];
      }

      const rows = await db
        .select({
          id: schema.documentEvents.id,
          eventType: schema.documentEvents.eventType,
          actorId: schema.documentEvents.actorId,
          createdAt: schema.documentEvents.createdAt,
        })
        .from(schema.documentEvents)
        .where(inArray(schema.documentEvents.documentId, uniqueDocumentIds))
        .orderBy(schema.documentEvents.createdAt);

      return rows.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        actorId: row.actorId,
        createdAt: row.createdAt,
      }));
    },
  };
}
