import type { Transaction } from "@bedrock/platform/persistence";

export interface PartiesDocumentsReadPort {
  hasDocumentsForCustomer: (
    customerId: string,
    tx?: Transaction,
  ) => Promise<boolean>;
}

export interface PartiesCurrenciesPort {
  assertCurrencyExists: (id: string) => Promise<void>;
  listCodesById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface PartiesRequisiteProvidersPort {
  assertProviderActive: (id: string) => Promise<void>;
}
