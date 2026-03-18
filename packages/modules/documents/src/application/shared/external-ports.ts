import type {
  DocumentActionPolicyService,
  DocumentModuleRuntime,
  DocumentRegistry,
} from "../../plugins";
import type {
  DocumentEventsRepository,
  DocumentLinksRepository,
  DocumentOperationsRepository,
  DocumentsCommandRepository,
} from "../documents/ports";

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
  transaction: unknown;
  moduleRuntime: DocumentModuleRuntime;
  idempotency: DocumentsIdempotencyPort;
  documentsCommand: DocumentsCommandRepository;
  documentEvents: DocumentEventsRepository;
  documentLinks: DocumentLinksRepository;
  documentOperations: DocumentOperationsRepository;
}

export interface DocumentsTransactionsPort {
  withTransaction<TResult>(
    run: (context: DocumentsTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}

export type DocumentsPolicyPort = DocumentActionPolicyService;

export type DocumentsRegistryPort = DocumentRegistry;
