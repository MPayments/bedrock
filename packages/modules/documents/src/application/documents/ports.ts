import type { ListDocumentsQuery } from "../../contracts/queries";
import type {
  Document,
  DocumentEvent,
  DocumentInitialLink,
  DocumentLink,
  DocumentOperation,
  DocumentPostingSnapshot,
  DocumentSnapshot,
} from "../../domain/document";

export interface DocumentWithPostingOperationRow {
  document: Document;
  postingOperationId: string | null;
}

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

export interface DocumentsQueryRepository {
  findDocumentByType(input: {
    documentId: string;
    docType: string;
  }): Promise<Document | null>;
  findDocumentWithPostingOperation(input: {
    documentId: string;
    docType: string;
  }): Promise<DocumentWithPostingOperationRow | null>;
  listDocuments(input: ListDocumentsQuery): Promise<{
    rows: DocumentWithPostingOperationRow[];
    total: number;
  }>;
  listDocumentsByIds(documentIds: string[]): Promise<Document[]>;
}

export interface DocumentsCommandRepository {
  findDocumentByType(input: {
    documentId: string;
    docType: string;
    forUpdate?: boolean;
  }): Promise<Document | null>;
  findDocumentByCreateIdempotencyKey(input: {
    docType: string;
    createIdempotencyKey: string;
  }): Promise<Document | null>;
  insertDocument(document: DocumentSnapshot): Promise<Document | null>;
  updateDocument(input: {
    documentId: string;
    docType: string;
    patch: Partial<DocumentSnapshot> & Record<string, unknown>;
  }): Promise<Document | null>;
}

export interface DocumentLinksRepository {
  insertInitialLinks(input: {
    document: Document;
    links: DocumentInitialLink[];
  }): Promise<void>;
  listDocumentLinks(documentId: string): Promise<DocumentLink[]>;
}

export interface DocumentEventsRepository {
  insertDocumentEvent(input: DocumentsRepositoryEventInput): Promise<void>;
  listDocumentEvents(documentId: string): Promise<DocumentEvent[]>;
  getLatestPostingArtifacts(
    documentId: string,
  ): Promise<Record<string, unknown> | null>;
}

export interface DocumentOperationsRepository {
  findPostingOperationId(input: { documentId: string }): Promise<string | null>;
  insertDocumentOperation(input: {
    documentId: string;
    operationId: string;
    kind: string;
  }): Promise<void>;
  resetPostingOperation(input: { operationId: string }): Promise<void>;
  listDocumentOperations(documentId: string): Promise<DocumentOperation[]>;
}

export interface DocumentSnapshotsRepository {
  findDocumentSnapshot(
    documentId: string,
  ): Promise<DocumentPostingSnapshot | null>;
  insertDocumentSnapshot(
    snapshot: Omit<DocumentPostingSnapshot, "id" | "createdAt">,
  ): Promise<void>;
}
