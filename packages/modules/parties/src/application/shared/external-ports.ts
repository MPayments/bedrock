import type { CounterpartiesCommandTxRepository } from "../counterparties/ports";
import type { CustomersCommandTxRepository } from "../customers/ports";
import type { CounterpartyGroupsCommandTxRepository } from "../groups/ports";
import type { CounterpartyRequisitesCommandTxRepository } from "../requisites/ports";

export interface PartiesDocumentsReadTxPort {
  hasDocumentsForCustomer: (customerId: string) => Promise<boolean>;
}

export interface PartiesCurrenciesPort {
  assertCurrencyExists: (id: string) => Promise<void>;
  listCodesById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface PartiesRequisiteProvidersPort {
  assertProviderActive: (id: string) => Promise<void>;
}

export interface PartiesTransactionContext {
  customers: CustomersCommandTxRepository;
  counterparties: CounterpartiesCommandTxRepository;
  groups: CounterpartyGroupsCommandTxRepository;
  requisites: CounterpartyRequisitesCommandTxRepository;
  documents: PartiesDocumentsReadTxPort;
}

export interface PartiesTransactionsPort {
  withTransaction<TResult>(
    run: (context: PartiesTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}
