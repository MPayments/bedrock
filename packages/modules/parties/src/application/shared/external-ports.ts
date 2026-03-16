import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type { CounterpartiesCommandTxRepository } from "../counterparties/ports";
import type { CustomersCommandTxRepository } from "../customers/ports";
import type { CounterpartyGroupsCommandTxRepository } from "../groups/ports";

export interface PartiesDocumentsReadPort {
  hasDocumentsForCustomer: (
    customerId: string,
    tx?: PersistenceSession,
  ) => Promise<boolean>;
}

export interface PartiesDocumentsReadTxPort {
  hasDocumentsForCustomer: (customerId: string) => Promise<boolean>;
}

export interface PartiesTransactionContext {
  customers: CustomersCommandTxRepository;
  counterparties: CounterpartiesCommandTxRepository;
  groups: CounterpartyGroupsCommandTxRepository;
  documents: PartiesDocumentsReadTxPort;
}

export interface PartiesTransactionsPort {
  withTransaction<TResult>(
    run: (context: PartiesTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}
