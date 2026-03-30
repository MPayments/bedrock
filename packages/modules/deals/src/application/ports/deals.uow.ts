import type { Transaction } from "@bedrock/platform/persistence";

import type { DealReads } from "./deal.reads";
import type { DealStore } from "./deal.store";

export interface DealsCommandTx {
  dealReads: DealReads;
  dealStore: DealStore;
  transaction: Transaction;
}

export interface DealsCommandUnitOfWork {
  run<T>(work: (tx: DealsCommandTx) => Promise<T>): Promise<T>;
}
