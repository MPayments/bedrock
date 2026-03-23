import type { DocumentEvent } from "../../domain/document";

export interface DocumentsRepositoryEventInput {
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
}

export interface DocumentEventsRepository {
  insertDocumentEvent(input: DocumentsRepositoryEventInput): Promise<void>;
  listDocumentEvents(documentId: string): Promise<DocumentEvent[]>;
  getLatestPostingArtifacts(
    documentId: string,
  ): Promise<Record<string, unknown> | null>;
}
