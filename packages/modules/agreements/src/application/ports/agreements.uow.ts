import type { Transaction } from "@bedrock/platform/persistence";

import type { AgreementReads } from "./agreement.reads";
import type { AgreementStore } from "./agreement.store";

export interface AgreementsCommandTx {
  transaction: Transaction;
  agreementReads: AgreementReads;
  agreementStore: AgreementStore;
}

export interface AgreementsCommandUnitOfWork {
  run<T>(work: (tx: AgreementsCommandTx) => Promise<T>): Promise<T>;
}
