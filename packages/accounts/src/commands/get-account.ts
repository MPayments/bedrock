import { eq } from "drizzle-orm";

import { ACCOUNT_NO } from "@bedrock/accounting";
import { schema } from "@bedrock/db/schema";

import { AccountNotFoundError } from "../errors";
import type { AccountServiceContext } from "../internal/context";

export function createGetAccountHandler(context: AccountServiceContext) {
  const { db } = context;

  return async function getAccount(id: string) {
    const [row] = await db
      .select({
        id: schema.operationalAccounts.id,
        counterpartyId: schema.operationalAccounts.counterpartyId,
        currencyId: schema.operationalAccounts.currencyId,
        accountProviderId: schema.operationalAccounts.accountProviderId,
        label: schema.operationalAccounts.label,
        description: schema.operationalAccounts.description,
        accountNo: schema.operationalAccounts.accountNo,
        corrAccount: schema.operationalAccounts.corrAccount,
        address: schema.operationalAccounts.address,
        iban: schema.operationalAccounts.iban,
        stableKey: schema.operationalAccounts.stableKey,
        postingAccountNo: schema.bookAccounts.accountNo,
        createdAt: schema.operationalAccounts.createdAt,
        updatedAt: schema.operationalAccounts.updatedAt,
      })
      .from(schema.operationalAccounts)
      .leftJoin(
        schema.operationalAccountsBookBindings,
        eq(
          schema.operationalAccountsBookBindings.operationalAccountId,
          schema.operationalAccounts.id,
        ),
      )
      .leftJoin(
        schema.bookAccounts,
        eq(
          schema.bookAccounts.id,
          schema.operationalAccountsBookBindings.bookAccountId,
        ),
      )
      .where(eq(schema.operationalAccounts.id, id))
      .limit(1);

    if (!row) {
      throw new AccountNotFoundError(id);
    }

    return {
      ...row,
      postingAccountNo: row.postingAccountNo ?? ACCOUNT_NO.BANK,
    };
  };
}
