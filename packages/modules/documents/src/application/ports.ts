import type {
  CompiledPack,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
} from "@bedrock/accounting/packs";
import type {
  CommitResult,
  LedgerOperationDetails,
  OperationIntent,
} from "@bedrock/ledger/contracts";

import type { ListDocumentsQuery } from "../contracts/validation";
import type {
  Document,
  DocumentEvent,
  DocumentInitialLink,
  DocumentLink,
  DocumentOperation,
  DocumentSnapshot,
} from "../domain/types";
import type { DocumentModuleRuntime } from "../plugins";

export interface DocumentsAccountingPort {
  getDefaultCompiledPack(): CompiledPack;
  loadActiveCompiledPackForBook(input?: {
    bookId?: string;
    at?: Date;
  }): Promise<CompiledPack>;
  resolvePostingPlan(
    input: ResolvePostingPlanInput,
  ): Promise<ResolvePostingPlanResult>;
}

export interface DocumentsAccountingPeriodsPort {
  assertOrganizationPeriodsOpen(input: {
    occurredAt: Date;
    organizationIds: string[];
    docType: string;
  }): Promise<void>;
  listClosedOrganizationIdsForPeriod(input: {
    organizationIds: string[];
    occurredAt: Date;
  }): Promise<string[]>;
  closePeriod(input: {
    organizationId: string;
    periodStart: Date;
    periodEnd: Date;
    closedBy: string;
    closeReason?: string | null;
    closeDocumentId: string;
  }): Promise<unknown>;
  isOrganizationPeriodClosed(input: {
    organizationId: string;
    occurredAt: Date;
  }): Promise<boolean>;
  reopenPeriod(input: {
    organizationId: string;
    periodStart: Date;
    reopenedBy: string;
    reopenReason?: string | null;
    reopenDocumentId?: string | null;
  }): Promise<unknown>;
}

export interface DocumentsLedgerCommitPort {
  commit(intent: OperationIntent): Promise<CommitResult>;
}

export interface DocumentsLedgerReadPort {
  listOperationDetails(
    operationIds: string[],
  ): Promise<Map<string, LedgerOperationDetails>>;
  getOperationDetails(operationId: string): Promise<LedgerOperationDetails | null>;
}

export interface DocumentsRepositoryRow {
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

export interface DocumentsRepository {
  findDocumentByType: (input: {
    documentId: string;
    docType: string;
    forUpdate?: boolean;
  }) => Promise<Document | null>;
  findDocumentWithPostingOperation: (input: {
    documentId: string;
    docType: string;
  }) => Promise<DocumentsRepositoryRow | null>;
  findDocumentByCreateIdempotencyKey: (input: {
    docType: string;
    createIdempotencyKey: string;
  }) => Promise<Document | null>;
  findPostingOperationId: (input: { documentId: string }) => Promise<string | null>;
  insertDocument: (document: Document) => Promise<Document | null>;
  updateDocument: (input: {
    documentId: string;
    docType: string;
    patch: Partial<Document> & Record<string, unknown>;
  }) => Promise<Document | null>;
  insertDocumentOperation: (input: {
    documentId: string;
    operationId: string;
    kind: string;
  }) => Promise<void>;
  resetPostingOperation: (input: { operationId: string }) => Promise<void>;
  insertDocumentEvent: (input: DocumentsRepositoryEventInput) => Promise<void>;
  insertInitialLinks: (input: {
    document: Document;
    links: DocumentInitialLink[];
  }) => Promise<void>;
  listDocuments: (input: ListDocumentsQuery) => Promise<{
    rows: DocumentsRepositoryRow[];
    total: number;
  }>;
  listDocumentLinks: (documentId: string) => Promise<DocumentLink[]>;
  listDocumentsByIds: (documentIds: string[]) => Promise<Document[]>;
  listDocumentOperations: (documentId: string) => Promise<DocumentOperation[]>;
  listDocumentEvents: (documentId: string) => Promise<DocumentEvent[]>;
  findDocumentSnapshot: (documentId: string) => Promise<DocumentSnapshot | null>;
  getLatestPostingArtifacts: (
    documentId: string,
  ) => Promise<Record<string, unknown> | null>;
}

export interface DocumentsIdempotencyPort {
  withIdempotency<TResult, TStoredResult = Record<string, unknown>>(input: {
    scope: string;
    idempotencyKey: string;
    request: unknown;
    actorId?: string | null;
    handler: () => Promise<TResult>;
    serializeResult: (result: TResult) => TStoredResult;
    loadReplayResult: (params: {
      storedResult: TStoredResult | null;
    }) => Promise<TResult>;
    serializeError?: (error: unknown) => Record<string, unknown>;
  }): Promise<TResult>;
}

export interface DocumentsTransactionContext {
  moduleRuntime: DocumentModuleRuntime;
  repository: DocumentsRepository;
  idempotency: DocumentsIdempotencyPort;
  ledger: DocumentsLedgerCommitPort;
}

export interface DocumentsTransactionsPort {
  withTransaction<TResult>(
    run: (context: DocumentsTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}
