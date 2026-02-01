import { and, eq } from "drizzle-orm";
import { schema } from "@repo/db/schema";
import { type Database } from "@repo/db";
import { tbAccountIdFor } from "./ids";
import { makeTbAccount, tbCreateAccountsOrThrow, type TbClient } from "./tb";
import { AccountMappingConflictError } from "./errors";

function accountCodeFromKey(key: string): number {
    let x = 0;
    for (let i = 0; i < key.length; i++) x = (x + key.charCodeAt(i) * (i + 1)) & 0xffff;
    return x || 1;
}

type ResolveTbAccountIdParams = {
    db: Database;
    tb: TbClient;
    orgId: string;
    key: string;
    currency: string;
    tbLedger: number;
};

export async function resolveTbAccountId(p: ResolveTbAccountIdParams): Promise<bigint> {
    const expected = tbAccountIdFor(p.orgId, p.key, p.tbLedger);

    const existing = await p.db
        .select({ tbAccountId: schema.ledgerAccounts.tbAccountId })
        .from(schema.ledgerAccounts)
        .where(and(eq(schema.ledgerAccounts.orgId, p.orgId), eq(schema.ledgerAccounts.tbLedger, p.tbLedger), eq(schema.ledgerAccounts.key, p.key)))
        .limit(1);

    if (existing.length) {
        const actual = existing[0]!.tbAccountId;
        if (actual !== expected) {
            throw new AccountMappingConflictError(
                `Ledger account mapping conflict (db!=deterministic) for key=${p.key}`,
                p.orgId,
                p.tbLedger,
                p.key,
                expected,
                actual
            );
        }
        return actual;
    }

    const code = accountCodeFromKey(p.key);

    await tbCreateAccountsOrThrow(p.tb, [makeTbAccount(expected, p.tbLedger, code)]);

    await p.db
        .insert(schema.ledgerAccounts)
        .values({
            orgId: p.orgId,
            key: p.key,
            currency: p.currency,
            tbLedger: p.tbLedger,
            tbAccountId: expected
        })
        .onConflictDoNothing();

    const again = await p.db
        .select({ tbAccountId: schema.ledgerAccounts.tbAccountId })
        .from(schema.ledgerAccounts)
        .where(and(eq(schema.ledgerAccounts.orgId, p.orgId), eq(schema.ledgerAccounts.tbLedger, p.tbLedger), eq(schema.ledgerAccounts.key, p.key)))
        .limit(1);

    if (!again.length) throw new Error("Failed to persist TB account mapping");

    const actual = again[0]!.tbAccountId;
    if (actual !== expected) {
        throw new AccountMappingConflictError(
            `Ledger account mapping conflict after insert (db!=deterministic) for key=${p.key}`,
            p.orgId,
            p.tbLedger,
            p.key,
            expected,
            actual
        );
    }

    return actual;
}
