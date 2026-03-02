import { eq } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/accounting";
import { schema } from "@bedrock/operational-accounts/schema";

import { AccountNotFoundError } from "../errors";
import type { OperationalAccountsServiceContext } from "../internal/context";

export function createGetOperationalAccountHandler(
  context: OperationalAccountsServiceContext,
) {
  const { db } = context;

  return async function getAccount(id: string) {
    const [row] = await db
      .select({
        id: schema.operationalAccounts.id,
        counterpartyId: schema.operationalAccounts.counterpartyId,
        bookId: schema.operationalAccountBindings.bookId,
        currencyId: schema.operationalAccounts.currencyId,
        accountProviderId: schema.operationalAccounts.accountProviderId,
        label: schema.operationalAccounts.label,
        description: schema.operationalAccounts.description,
        accountNo: schema.operationalAccounts.accountNo,
        corrAccount: schema.operationalAccounts.corrAccount,
        address: schema.operationalAccounts.address,
        iban: schema.operationalAccounts.iban,
        stableKey: schema.operationalAccounts.stableKey,
        postingAccountNo: schema.bookAccountInstances.accountNo,
        createdAt: schema.operationalAccounts.createdAt,
        updatedAt: schema.operationalAccounts.updatedAt,
      })
      .from(schema.operationalAccounts)
      .leftJoin(
        schema.operationalAccountBindings,
        eq(
          schema.operationalAccountBindings.operationalAccountId,
          schema.operationalAccounts.id,
        ),
      )
      .leftJoin(
        schema.bookAccountInstances,
        eq(
          schema.bookAccountInstances.id,
          schema.operationalAccountBindings.bookAccountInstanceId,
        ),
      )
      .where(eq(schema.operationalAccounts.id, id))
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
