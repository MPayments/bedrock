import type { Transaction } from "@bedrock/platform/persistence";

import type { OrganizationsCommandTxRepository } from "../organizations/ports";
import type {
  OrganizationRequisiteBindingsCommandTxRepository,
  OrganizationsRequisiteSubjectsPort,
} from "../requisites/ports";

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
  tx: Transaction;
  organizations: OrganizationsCommandTxRepository;
  requisiteBindings: OrganizationRequisiteBindingsCommandTxRepository;
  ledgerBooks: OrganizationsLedgerBooksTxPort;
  ledgerBindings: OrganizationsLedgerBindingsTxPort;
}

export interface OrganizationsTransactionsPort {
  withTransaction<TResult>(
    run: (context: OrganizationsTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}

export type { OrganizationsRequisiteSubjectsPort };
