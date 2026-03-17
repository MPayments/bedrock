import type { DocumentRequestContext, DocumentTransitionAction } from "../../contracts/commands";
import type { Document } from "../../domain/document";
import { collectDocumentOrganizationIds } from "../../domain/document-period-scope";
import type { DocumentEventsRepository } from "../documents/ports";
import type { DocumentsServiceContext } from "./context";
import { buildDefaultActionIdempotencyKey } from "./idempotency-key";

export interface DocumentActionEvent {
  eventType: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reasonMeta?: Record<string, unknown> | null;
}

export function buildDocumentActionIdempotencyKey(
  action: DocumentTransitionAction,
  input: {
    docType: string;
    documentId: string;
    actorUserId: string;
  },
) {
  return buildDefaultActionIdempotencyKey(`documents.${action}`, {
    docType: input.docType,
    documentId: input.documentId,
    actorUserId: input.actorUserId,
  });
}

export function buildDocumentActionEvent(input: {
  eventType: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reasonMeta?: Record<string, unknown> | null;
}): DocumentActionEvent {
  return {
    eventType: input.eventType,
    before: input.before,
    after: input.after,
    reasonMeta: input.reasonMeta,
  };
}

export async function assertOrganizationPeriodsOpenForDocument(input: {
  context: DocumentsServiceContext;
  document: Document;
  docType: string;
}) {
  const organizationIds = collectDocumentOrganizationIds({
    payload: input.document.payload,
  });

  await input.context.accountingPeriods.assertOrganizationPeriodsOpen({
    occurredAt: input.document.occurredAt,
    organizationIds,
    docType: input.docType,
  });
}

export async function insertDocumentEvents(input: {
  documentEvents: DocumentEventsRepository;
  events: DocumentActionEvent[];
  documentId: string;
  actorUserId: string;
  requestContext?: DocumentRequestContext;
}) {
  for (const event of input.events) {
    await input.documentEvents.insertDocumentEvent({
      documentId: input.documentId,
      eventType: event.eventType,
      actorId: input.actorUserId,
      requestId: input.requestContext?.requestId,
      correlationId: input.requestContext?.correlationId,
      traceId: input.requestContext?.traceId,
      causationId: input.requestContext?.causationId,
      before: event.before,
      after: event.after,
      reasonMeta: event.reasonMeta ?? null,
    });
  }
}
