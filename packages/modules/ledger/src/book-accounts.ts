import type { Queryable, Transaction } from "@bedrock/platform/persistence";

import { createEnsureBookAccountInstanceHandler } from "./application/book-accounts/ensure-book-account-instance";
import type { BookAccountIdentityInput } from "./domain/book-account-identity";
import { createDrizzleLedgerBookAccountsRepository } from "./infra/drizzle/repos/book-account-instances-repository";

export interface LedgerBookAccountsService {
  ensureBookAccountInstance: (input: BookAccountIdentityInput) => Promise<{
    id: string;
    dimensionsHash: string;
    tbLedger: number;
    tbAccountId: bigint;
  }>;
}

export function createLedgerBookAccountsService(input: {
  db: Queryable;
}): LedgerBookAccountsService {
  const ensureBookAccountInstanceTx = createEnsureBookAccountInstanceHandler({
    bookAccounts: createDrizzleLedgerBookAccountsRepository(),
  });

  return {
    ensureBookAccountInstance(identity: BookAccountIdentityInput) {
      return ensureBookAccountInstanceTx(input.db as Transaction, identity);
    },
  };
}
