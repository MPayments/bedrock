import { eq } from "drizzle-orm";

import { schema } from "@bedrock/core/counterparty-accounts/schema";

import { AccountBindingNotFoundError, AccountNotFoundError } from "../errors";
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

    if (!row.bookId || !row.postingAccountNo) {
      throw new AccountBindingNotFoundError(id);
    }

    return {
      id: row.id,
      counterpartyId: row.counterpartyId,
      bookId: row.bookId,
      currencyId: row.currencyId,
      accountProviderId: row.accountProviderId,
      label: row.label,
      description: row.description,
      accountNo: row.accountNo,
      corrAccount: row.corrAccount,
      address: row.address,
      iban: row.iban,
      postingAccountNo: row.postingAccountNo,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  };
}
