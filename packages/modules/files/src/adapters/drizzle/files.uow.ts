import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleFileReads } from "./file.reads";
import { DrizzleFileStore } from "./file.store";
import type {
  FilesCommandTx,
  FilesCommandUnitOfWork,
} from "../../application/ports/files.uow";

function bindFilesTx(transaction: Transaction): FilesCommandTx {
  return {
    fileReads: new DrizzleFileReads(transaction),
    fileStore: new DrizzleFileStore(transaction),
  };
}

export class DrizzleFilesUnitOfWork implements FilesCommandUnitOfWork {
  private readonly transactional: TransactionalPort<FilesCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(input.persistence, bindFilesTx);
  }

  run<T>(work: (tx: FilesCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
