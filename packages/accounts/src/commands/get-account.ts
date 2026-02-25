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
                id: schema.accounts.id,
                counterpartyId: schema.accounts.counterpartyId,
                currencyId: schema.accounts.currencyId,
                accountProviderId: schema.accounts.accountProviderId,
                label: schema.accounts.label,
                description: schema.accounts.description,
                accountNo: schema.accounts.accountNo,
                corrAccount: schema.accounts.corrAccount,
                address: schema.accounts.address,
                iban: schema.accounts.iban,
                stableKey: schema.accounts.stableKey,
                postingAccountNo: schema.bookAccounts.accountNo,
                createdAt: schema.accounts.createdAt,
                updatedAt: schema.accounts.updatedAt,
            })
            .from(schema.accounts)
            .leftJoin(
                schema.operationalAccountBindings,
                eq(schema.operationalAccountBindings.accountId, schema.accounts.id),
            )
            .leftJoin(
                schema.bookAccounts,
                eq(schema.bookAccounts.id, schema.operationalAccountBindings.bookAccountId),
            )
            .where(eq(schema.accounts.id, id))
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
