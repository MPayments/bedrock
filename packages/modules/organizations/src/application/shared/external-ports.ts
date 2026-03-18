import type { OrganizationsCommandRepository } from "../organizations/ports";

export interface OrganizationsLedgerReadPort {
  listBooksById: (bookIds: string[]) => Promise<
    {
      id: string;
      ownerId: string | null;
    }[]
  >;
}

export interface OrganizationsTransactionContext {
  organizations: OrganizationsCommandRepository;
}

export interface OrganizationsTransactionsPort {
  withTransaction<TResult>(
    run: (context: OrganizationsTransactionContext) => Promise<TResult>,
  ): Promise<TResult>;
}
