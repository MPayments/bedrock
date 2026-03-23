import { and, desc, eq } from "drizzle-orm";

import type {
  Queryable,
} from "@bedrock/platform/persistence";
import { pgNotify } from "@bedrock/platform/persistence/notify";

import { schema } from "./schema";
import { toStoredJson } from "./stored-json";
import type {
  DocumentEventsRepository,
  DocumentsRepositoryEventInput,
} from "../../application/ports";

function readRecordStringField(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function readRecordIntField(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export class DrizzleDocumentEventsRepository implements DocumentEventsRepository {
  constructor(private readonly db: Queryable) {}

  async insertDocumentEvent(input: DocumentsRepositoryEventInput) {
    await this.db.insert(schema.documentEvents).values({
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
      this.db,
      "document_changed",
      JSON.stringify({
        documentId: input.documentId,
        docType,
        version,
        eventType: input.eventType,
      }),
    );
  }

  listDocumentEvents(documentId: string) {
    return this.db
      .select()
      .from(schema.documentEvents)
      .where(eq(schema.documentEvents.documentId, documentId))
      .orderBy(schema.documentEvents.createdAt);
  }

  async getLatestPostingArtifacts(documentId: string) {
    const [row] = await this.db
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
  }
}
