import { eq, inArray, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { SYSTEM_TRANSFERS_LEDGER_ORG_ID } from "@bedrock/kernel/constants";

import { AccountNotFoundError } from "../errors";
import type { AccountServiceContext } from "../internal/context";
import {
    ResolveTransferBindingsInputSchema,
    type ResolveTransferBindingsInput,
    type TransferAccountBinding,
} from "../validation";

function makeTransferLedgerKey(
    counterpartyId: string,
    stableKey: string,
    currencyCode: string,
) {
    return `tr2:Account:${counterpartyId}:${stableKey}:${currencyCode}`;
}

export function createResolveTransferBindingsHandler(context: AccountServiceContext) {
    const { db, log } = context;

    return async function resolveTransferBindings(
        input: ResolveTransferBindingsInput,
    ): Promise<TransferAccountBinding[]> {
        const validated = ResolveTransferBindingsInputSchema.parse(input);
        const uniqueAccountIds = [...new Set(validated.accountIds)];

        const rows = await db
            .select({
                accountId: schema.accounts.id,
                counterpartyId: schema.accounts.counterpartyId,
                currencyId: schema.accounts.currencyId,
                currencyCode: schema.currencies.code,
                stableKey: schema.accounts.stableKey,
            })
            .from(schema.accounts)
            .innerJoin(schema.currencies, eq(schema.accounts.currencyId, schema.currencies.id))
            .where(inArray(schema.accounts.id, uniqueAccountIds));

        if (rows.length !== uniqueAccountIds.length) {
            const foundIds = new Set(rows.map((row) => row.accountId));
            const missingId = uniqueAccountIds.find((id) => !foundIds.has(id)) ?? uniqueAccountIds[0]!;
            throw new AccountNotFoundError(missingId);
        }

        const byAccountId = new Map<string, TransferAccountBinding>();
        const bindingRows: typeof schema.accountLedgerBindings.$inferInsert[] = [];

        for (const row of rows) {
            const ledgerKey = makeTransferLedgerKey(
                row.counterpartyId,
                row.stableKey,
                row.currencyCode,
            );

            byAccountId.set(row.accountId, {
                accountId: row.accountId,
                counterpartyId: row.counterpartyId,
                currencyId: row.currencyId,
                currencyCode: row.currencyCode,
                stableKey: row.stableKey,
                ledgerOrgId: SYSTEM_TRANSFERS_LEDGER_ORG_ID,
                ledgerKey,
            });

            bindingRows.push({
                accountId: row.accountId,
                ledgerOrgId: SYSTEM_TRANSFERS_LEDGER_ORG_ID,
                ledgerKey,
                currencyId: row.currencyId,
            });
        }

        if (bindingRows.length > 0) {
            await db
                .insert(schema.accountLedgerBindings)
                .values(bindingRows)
                .onConflictDoUpdate({
                    target: schema.accountLedgerBindings.accountId,
                    set: {
                        ledgerOrgId: SYSTEM_TRANSFERS_LEDGER_ORG_ID,
                        ledgerKey: sql`excluded.ledger_key`,
                        currencyId: sql`excluded.currency_id`,
                        updatedAt: sql`now()`,
                    },
                });
        }

        const orderedBindings = validated.accountIds.map((id) => byAccountId.get(id)!);
        log.debug("Resolved transfer account bindings", {
            requested: validated.accountIds.length,
            uniqueAccounts: uniqueAccountIds.length,
        });

        return orderedBindings;
    };
}
