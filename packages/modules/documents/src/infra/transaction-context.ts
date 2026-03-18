import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type {
  PersistenceContext,
  Queryable,
  Transaction,
} from "@bedrock/platform/persistence";

import {
  createDrizzleDocumentEventsRepository,
  createDrizzleDocumentLinksRepository,
  createDrizzleDocumentOperationsRepository,
  createDrizzleDocumentsCommandRepository,
} from "./drizzle/repository";
import type {
  DocumentsIdempotencyPort,
  DocumentsTransactionContext,
  DocumentsTransactionsPort,
} from "../application/shared/external-ports";
import type { DocumentModuleRuntime } from "../plugins";
import { createDrizzleDocumentsReadModel } from "../read-model";

export function createDocumentsModuleRuntime(
  queryable: Queryable,
): DocumentModuleRuntime {
  return {
    documents: createDrizzleDocumentsReadModel({ db: queryable }),
    withQueryable: (run) => run(queryable),
  };
}

export function createDocumentsIdempotencyPort(input: {
  tx: Transaction;
  idempotency: IdempotencyPort;
}): DocumentsIdempotencyPort {
  return {
    withIdempotency<TResult, TStoredResult = Record<string, unknown>>(params: {
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
    }) {
      return input.idempotency.withIdempotencyTx<TResult, TStoredResult>({
        tx: input.tx,
        scope: params.scope,
        idempotencyKey: params.idempotencyKey,
        request: params.request,
        actorId: params.actorId,
        handler: params.handler,
        serializeResult: params.serializeResult,
        loadReplayResult: ({ storedResult }) =>
          params.loadReplayResult({
            storedResult: (storedResult as TStoredResult | null) ?? null,
          }),
        serializeError: params.serializeError,
      });
    },
  };
}

export function createDocumentsTransactionContext(input: {
  tx: Transaction;
  idempotency: IdempotencyPort;
}): DocumentsTransactionContext {
  return {
    moduleRuntime: createDocumentsModuleRuntime(input.tx),
    idempotency: createDocumentsIdempotencyPort(input),
    documentsCommand: createDrizzleDocumentsCommandRepository(input.tx),
    documentEvents: createDrizzleDocumentEventsRepository(input.tx),
    documentLinks: createDrizzleDocumentLinksRepository(input.tx),
    documentOperations: createDrizzleDocumentOperationsRepository(input.tx),
  };
}

export function createDocumentsTransactions(input: {
  persistence: PersistenceContext;
  idempotency: IdempotencyPort;
}): DocumentsTransactionsPort {
  return {
    async withTransaction(run) {
      return input.persistence.runInTransaction((tx) =>
        run(
          createDocumentsTransactionContext({
            tx,
            idempotency: input.idempotency,
          }),
        ),
      );
    },
  };
}
