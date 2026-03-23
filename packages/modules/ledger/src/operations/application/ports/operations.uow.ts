import type { LedgerOperationsRepository } from "./operations.repository";
import type { LedgerBookAccountStore } from "../../../book-accounts/application/ports/book-account.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface OperationsCommandTx {
  bookAccounts: LedgerBookAccountStore;
  operations: LedgerOperationsRepository;
}

export type OperationsCommandUnitOfWork = UnitOfWork<OperationsCommandTx>;
