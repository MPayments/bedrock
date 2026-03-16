import type { Transaction } from "@bedrock/platform/persistence";

import type { OrganizationsCommandTxRepository } from "../organizations/ports";

export interface OrganizationsLedgerReadPort {
  listBooksById: (bookIds: string[]) => Promise<
    {
      id: string;
      ownerId: string | null;
    }[]
  >;
}

export interface OrganizationsTransactionContext {
  tx: Transaction;
  organizations: OrganizationsCommandTxRepository;
}

export interface OrganizationsTransactionsPort {
  withTransaction<TResult>(
    run: (context: OrganizationsTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}
