import type {
  DocumentEventsRepository,
  DocumentSnapshotsRepository,
  DocumentsCommandRepository,
} from "../../../documents/application/ports";

export interface DocumentsPostingWorkerTx {
  documentEvents: DocumentEventsRepository;
  documentSnapshots: DocumentSnapshotsRepository;
  documentsCommand: DocumentsCommandRepository;
}

export interface DocumentsPostingWorkerUnitOfWork {
  run<TResult>(work: (tx: DocumentsPostingWorkerTx) => Promise<TResult>): Promise<TResult>;
}
