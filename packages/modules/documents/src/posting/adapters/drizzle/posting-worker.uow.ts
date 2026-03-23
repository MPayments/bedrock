import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleDocumentEventsRepository } from "../../../documents/adapters/drizzle/document-event.repository";
import { DrizzleDocumentSnapshotsRepository } from "../../../documents/adapters/drizzle/document-snapshot.repository";
import { DrizzleDocumentsRepository } from "../../../documents/adapters/drizzle/documents.repository";
import type {
  DocumentsPostingWorkerTx,
  DocumentsPostingWorkerUnitOfWork,
} from "../../application/ports/posting-worker.uow";

function bindDocumentsPostingWorkerTx(
  tx: Transaction,
): DocumentsPostingWorkerTx {
  return {
    documentEvents: new DrizzleDocumentEventsRepository(tx),
    documentSnapshots: new DrizzleDocumentSnapshotsRepository(tx),
    documentsCommand: new DrizzleDocumentsRepository(tx),
  };
}

export class DrizzleDocumentsPostingWorkerUnitOfWork
  implements DocumentsPostingWorkerUnitOfWork
{
  private readonly transactional: TransactionalPort<DocumentsPostingWorkerTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindDocumentsPostingWorkerTx,
    );
  }

  run<TResult>(work: (tx: DocumentsPostingWorkerTx) => Promise<TResult>): Promise<TResult> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
