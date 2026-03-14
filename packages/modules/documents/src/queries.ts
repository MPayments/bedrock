import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";

import { schema } from "./schema";

type Queryable = Database | Transaction;

export interface DocumentOperationRef {
  operationId: string;
  documentId: string;
  documentType: string;
  channel: string | null;
}

export interface DocumentAdjustmentRow {
  documentId: string;
  docType: string;
  docNo: string;
  occurredAt: Date;
  title: string;
}

export interface DocumentAuditEventRow {
  id: string;
  eventType: string;
  actorId: string | null;
  createdAt: Date;
}

export interface DocumentsQueries {
  listDocumentLabelsById: (ids: string[]) => Promise<Map<string, string>>;
  listOperationDocumentRefs: (
    operationIds: string[],
  ) => Promise<Map<string, DocumentOperationRef>>;
  listAdjustmentsForOrganizationPeriod: (input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    docTypes: string[];
  }) => Promise<DocumentAdjustmentRow[]>;
  listAuditEventsByDocumentId: (
    documentIds: string[],
  ) => Promise<DocumentAuditEventRow[]>;
}

export function createDocumentsQueries(input: { db: Queryable }): DocumentsQueries {
  const { db } = input;

  return {
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
