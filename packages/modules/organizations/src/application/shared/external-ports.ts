import type { OrganizationsCommandTxRepository } from "../organizations/ports";
import type { OrganizationRequisitesCommandTxRepository } from "../requisites/ports";

export interface OrganizationsLedgerReadPort {
  listBooksById: (
    bookIds: string[],
  ) => Promise<
    {
      id: string;
      ownerId: string | null;
    }[]
  >;
}

export interface OrganizationsCurrenciesPort {
  assertCurrencyExists: (id: string) => Promise<void>;
  listCodesById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface OrganizationsRequisiteProvidersPort {
  assertProviderActive: (id: string) => Promise<void>;
}

export interface OrganizationsLedgerBooksTxPort {
  ensureDefaultOrganizationBook: (input: {
    organizationId: string;
  }) => Promise<{ bookId: string }>;
}

export interface OrganizationsLedgerBindingsTxPort {
  ensureOrganizationPostingTarget: (input: {
    organizationId: string;
    currencyCode: string;
    postingAccountNo: string;
  }) => Promise<{
    bookId: string;
    bookAccountInstanceId: string;
  }>;
}

export interface OrganizationsTransactionContext {
  organizations: OrganizationsCommandTxRepository;
  requisites: OrganizationRequisitesCommandTxRepository;
  ledgerBooks: OrganizationsLedgerBooksTxPort;
  ledgerBindings: OrganizationsLedgerBindingsTxPort;
}

export interface OrganizationsTransactionsPort {
  withTransaction<TResult>(
    run: (context: OrganizationsTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}
