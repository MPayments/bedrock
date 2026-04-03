import type { Transaction } from "@bedrock/platform/persistence";

import type { FileReads } from "./file.reads";
import type { FileStore } from "./file.store";

export interface FilesCommandTx {
  fileReads: FileReads;
  fileStore: FileStore;
  transaction: Transaction;
}

export interface FilesCommandUnitOfWork {
  run<T>(work: (tx: FilesCommandTx) => Promise<T>): Promise<T>;
}
