import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import {
  createTransactionalPort,
  type PersistenceContext,
  type Queryable,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleDocumentEventsRepository } from "../../../documents/adapters/drizzle/document-event.repository";
import { DrizzleDocumentLinksRepository } from "../../../documents/adapters/drizzle/document-link.repository";
import { DrizzleDocumentOperationsRepository } from "../../../documents/adapters/drizzle/document-operation.repository";
import { DrizzleDocumentsReadModel } from "../../../documents/adapters/drizzle/documents.read-model";
import { DrizzleDocumentsRepository } from "../../../documents/adapters/drizzle/documents.repository";
import type { DocumentsCommandTx, DocumentsCommandUnitOfWork } from "../../../documents/application/ports";
import type { LifecycleCommandTx, LifecycleCommandUnitOfWork } from "../../../lifecycle/application/ports/lifecycle.uow";
import type { DocumentModuleRuntime } from "../../../plugins";
import type { PostingCommandTx, PostingCommandUnitOfWork } from "../../../posting/application/ports";
import type { DocumentsIdempotencyPort } from "../../application/idempotency.port";

type DocumentsModuleTx = DocumentsCommandTx & LifecycleCommandTx & PostingCommandTx;

export class DrizzleDocumentsModuleRuntime implements DocumentModuleRuntime {
  readonly documents: DocumentModuleRuntime["documents"];

  constructor(queryable: Queryable) {
    this.documents = new DrizzleDocumentsReadModel(queryable);
  }
}

class DrizzleDocumentsIdempotencyPort implements DocumentsIdempotencyPort {
  constructor(
    private readonly tx: Transaction,
    private readonly idempotency: IdempotencyPort,
  ) {}

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
  }): Promise<TResult> {
    return this.idempotency.withIdempotencyTx<TResult, TStoredResult>({
      tx: this.tx,
      scope: input.scope,
      idempotencyKey: input.idempotencyKey,
      request: input.request,
      actorId: input.actorId,
      handler: input.handler,
      serializeResult: input.serializeResult,
      loadReplayResult: ({ storedResult }) =>
        input.loadReplayResult({
          storedResult: (storedResult as TStoredResult | null) ?? null,
        }),
      serializeError: input.serializeError,
    });
  }
}

function bindDocumentsModuleTx(input: {
  tx: Transaction;
  idempotency: IdempotencyPort;
}): DocumentsModuleTx {
  return {
    transaction: input.tx,
    moduleRuntime: new DrizzleDocumentsModuleRuntime(input.tx),
    idempotency: new DrizzleDocumentsIdempotencyPort(
      input.tx,
      input.idempotency,
    ),
    documentsCommand: new DrizzleDocumentsRepository(input.tx),
    documentEvents: new DrizzleDocumentEventsRepository(input.tx),
    documentLinks: new DrizzleDocumentLinksRepository(input.tx),
    documentOperations: new DrizzleDocumentOperationsRepository(input.tx),
  };
}

export class DrizzleDocumentsUnitOfWork
  implements
    DocumentsCommandUnitOfWork,
    LifecycleCommandUnitOfWork,
    PostingCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<DocumentsModuleTx>;

  constructor(input: {
    persistence: PersistenceContext;
    idempotency: IdempotencyPort;
  }) {
    this.transactional = createTransactionalPort(input.persistence, (tx) =>
      bindDocumentsModuleTx({
        tx,
        idempotency: input.idempotency,
      }),
    );
  }

  run<TResult>(work: (tx: DocumentsModuleTx) => Promise<TResult>): Promise<TResult> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
