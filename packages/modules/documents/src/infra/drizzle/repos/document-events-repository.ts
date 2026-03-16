import { and, desc, eq } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/platform/persistence";
import { pgNotify } from "@bedrock/platform/persistence/notify";

import type {
  DocumentEventsRepository,
  DocumentsRepositoryEventInput,
} from "../../../application/documents/ports";
import { schema } from "../schema";
import { toStoredJson } from "../stored-json";

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

export function createDrizzleDocumentEventsRepository(
  db: Database | Transaction,
): DocumentEventsRepository {
  return {
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
    async listDocumentEvents(documentId) {
      return db
        .select()
        .from(schema.documentEvents)
        .where(eq(schema.documentEvents.documentId, documentId))
        .orderBy(schema.documentEvents.createdAt);
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
