import type { Transaction } from "@bedrock/adapter-db-drizzle/db/types";
import { canonicalJson } from "@bedrock/core/canon";
import { pgNotify } from "@bedrock/adapter-db-drizzle/db/notify";
import type { Document } from "@bedrock/documents/schema";
import { schema } from "@bedrock/documents/schema";

export function buildDocNo(prefix: string, documentId: string) {
  return `${prefix}-${documentId.slice(0, 8).toUpperCase()}`;
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

export function buildDocumentEventState(document: Document) {
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

export async function insertDocumentEvent(
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
