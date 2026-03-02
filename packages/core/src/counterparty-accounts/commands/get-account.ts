import { eq } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/core/accounting";
import { schema } from "@bedrock/core/counterparty-accounts/schema";

import { AccountNotFoundError } from "../errors";
import type { CounterpartyAccountsServiceContext } from "../internal/context";

export function createGetCounterpartyAccountHandler(
  context: CounterpartyAccountsServiceContext,
) {
  const { db } = context;

  return async function getAccount(id: string) {
    const [row] = await db
      .select({
        id: schema.counterpartyAccounts.id,
        counterpartyId: schema.counterpartyAccounts.counterpartyId,
        bookId: schema.counterpartyAccountBindings.bookId,
        currencyId: schema.counterpartyAccounts.currencyId,
        accountProviderId: schema.counterpartyAccounts.accountProviderId,
        label: schema.counterpartyAccounts.label,
        description: schema.counterpartyAccounts.description,
        accountNo: schema.counterpartyAccounts.accountNo,
        corrAccount: schema.counterpartyAccounts.corrAccount,
        address: schema.counterpartyAccounts.address,
        iban: schema.counterpartyAccounts.iban,
        stableKey: schema.counterpartyAccounts.stableKey,
        postingAccountNo: schema.bookAccountInstances.accountNo,
        createdAt: schema.counterpartyAccounts.createdAt,
        updatedAt: schema.counterpartyAccounts.updatedAt,
      })
      .from(schema.counterpartyAccounts)
      .leftJoin(
        schema.counterpartyAccountBindings,
        eq(
          schema.counterpartyAccountBindings.counterpartyAccountId,
          schema.counterpartyAccounts.id,
        ),
      )
      .leftJoin(
        schema.bookAccountInstances,
        eq(
          schema.bookAccountInstances.id,
          schema.counterpartyAccountBindings.bookAccountInstanceId,
        ),
      )
      .where(eq(schema.counterpartyAccounts.id, id))
      .limit(1);

    if (!row) {
      throw new AccountNotFoundError(id);
    }

    return {
      ...row,
      bookId: row.bookId ?? row.counterpartyId,
      postingAccountNo: row.postingAccountNo ?? ACCOUNT_NO.BANK,
    };
  };
}
