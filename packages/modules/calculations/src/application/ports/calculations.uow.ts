import type { Transaction } from "@bedrock/platform/persistence";

import type { CalculationReads } from "./calculation.reads";
import type { CalculationStore } from "./calculation.store";

export interface CalculationsCommandTx {
  calculationReads: CalculationReads;
  calculationStore: CalculationStore;
  transaction: Transaction;
}

export interface CalculationsCommandUnitOfWork {
  run<T>(work: (tx: CalculationsCommandTx) => Promise<T>): Promise<T>;
}
