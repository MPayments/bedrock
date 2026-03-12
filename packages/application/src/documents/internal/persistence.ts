import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  schema,
  type Document,
} from "@bedrock/application/documents/schema";
import { pgNotify } from "@bedrock/common/db/notify";
import type { Database, Transaction } from "@bedrock/common/db/types";

import { DocumentNotFoundError } from "../errors";
import type { DocumentRegistry } from "../types";
import { buildDocumentWithOperationId } from "./actions";
import { buildDocNo, toStoredJson } from "./document-state";

type Queryable = Database | Transaction;

export function createDocumentInsertBase(params: {
  id?: string;
  docType: string;
  docNoPrefix: string;
  moduleId: string;
  moduleVersion: number;
  payloadVersion: number;
  payload: Record<string, unknown>;
  occurredAt: Date;
  createIdempotencyKey: string;
  createdBy: string;
  approvalStatus: Document["approvalStatus"];
  postingStatus: Document["postingStatus"];
}) {
  const id = params.id ?? randomUUID();
  return {
    id,
    docType: params.docType,
    docNo: buildDocNo(params.docNoPrefix, id),
    moduleId: params.moduleId,
    moduleVersion: params.moduleVersion,
    payloadVersion: params.payloadVersion,
    payload: params.payload,
    title: "",
    occurredAt: params.occurredAt,
    submissionStatus: "draft" as const,
    approvalStatus: params.approvalStatus,
    postingStatus: params.postingStatus,
    lifecycleStatus: "active" as const,
    createIdempotencyKey: params.createIdempotencyKey,
    amountMinor: null,
    currency: null,
    memo: null,
    counterpartyId: null,
    customerId: null,
    organizationRequisiteId: null,
    searchText: "",
    createdBy: params.createdBy,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    postingStartedAt: null,
    postedAt: null,
    postingError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  } satisfies Document;
}

export async function lockDocument(
  db: Queryable,
  documentId: string,
  docType: string,
): Promise<Document> {
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(
      and(eq(schema.documents.id, documentId), eq(schema.documents.docType, docType)),
    )
    .for("update")
    .limit(1);

  if (!document) {
    throw new DocumentNotFoundError(documentId);
  }

  return document;
}

export async function getDocumentOrNull(
  db: Queryable,
  documentId: string,
  docType: string,
) {
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(
      and(eq(schema.documents.id, documentId), eq(schema.documents.docType, docType)),
    )
    .limit(1);

  return document ?? null;
}

export async function getDocumentByCreateIdempotencyKey(
  db: Queryable,
  docType: string,
  createIdempotencyKey: string,
) {
  const [document] = await db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.docType, docType),
        eq(schema.documents.createIdempotencyKey, createIdempotencyKey),
      ),
    )
    .limit(1);

  return document ?? null;
}

export async function getPostingOperationId(
  db: Queryable,
  documentId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ operationId: schema.documentOperations.operationId })
    .from(schema.documentOperations)
    .where(
      and(
        eq(schema.documentOperations.documentId, documentId),
        eq(schema.documentOperations.kind, "post"),
      ),
    )
    .limit(1);

  return row?.operationId ?? null;
}

export async function loadDocumentWithOperationId(
  db: Queryable,
  docType: string,
  documentId: string,
  storedOperationId?: string | null,
  registry?: DocumentRegistry,
) {
  const document = await getDocumentOrNull(db, documentId, docType);
  if (!document) {
    throw new DocumentNotFoundError(documentId);
  }

  return buildDocumentWithOperationId({
    registry,
    document,
    postingOperationId:
      storedOperationId ?? (await getPostingOperationId(db, document.id)),
  });
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

export async function insertDocumentEvent(
  tx: Transaction,
  input: {
    documentId: string;
    eventType: string;
    actorId?: string | null;
    requestId?: string | null;
    correlationId?: string | null;
    traceId?: string | null;
    causationId?: string | null;
    reasonCode?: string | null;
    reasonMeta?: Record<string, unknown> | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
) {
  await tx.insert(schema.documentEvents).values({
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

export async function getLatestPostingArtifacts(
  tx: Queryable,
  documentId: string,
) {
  const [row] = await tx
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
