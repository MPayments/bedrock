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

    // Check if account already exists in DB
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

    // Account doesn't exist - use DB-first approach to prevent TOCTOU race:
    // 1. Insert into DB first (establishes ownership via unique constraint)
    // 2. Then create in TigerBeetle (idempotent operation)
    // This ensures DB is always the source of truth and races are handled by DB constraints

    const code = accountCodeFromKey(p.key);

    // Try to insert into DB first - this acts as a lock
    // If another process races, one will succeed and one will hit conflict
    const inserted = await p.db
        .insert(schema.ledgerAccounts)
        .values({
            orgId: p.orgId,
            key: p.key,
            currency: p.currency,
            tbLedger: p.tbLedger,
            tbAccountId: expected
        })
        .onConflictDoNothing()
        .returning({ tbAccountId: schema.ledgerAccounts.tbAccountId });

    if (inserted.length) {
        // We won the race - now create the account in TigerBeetle
        // TigerBeetle's createAccounts is idempotent for same ID, so even if this
        // fails and we retry later, or if another process somehow also calls this,
        // it will succeed or return "exists" which we treat as success
        await tbCreateAccountsOrThrow(p.tb, [makeTbAccount(expected, p.tbLedger, code)]);
        return expected;
    }

    // Another process won the race - fetch the existing record
    const refetch = await p.db
        .select({ tbAccountId: schema.ledgerAccounts.tbAccountId })
        .from(schema.ledgerAccounts)
        .where(and(eq(schema.ledgerAccounts.orgId, p.orgId), eq(schema.ledgerAccounts.tbLedger, p.tbLedger), eq(schema.ledgerAccounts.key, p.key)))
        .limit(1);

    if (!refetch.length) {
        // Extremely unlikely: conflict happened but row not found (deleted between conflict and refetch?)
        throw new Error("Account mapping conflict but row not found - concurrent modification?");
    }

    const actual = refetch[0]!.tbAccountId;
    if (actual !== expected) {
        throw new AccountMappingConflictError(
            `Ledger account mapping conflict after race (db!=deterministic) for key=${p.key}`,
            p.orgId,
            p.tbLedger,
            p.key,
            expected,
            actual
        );
    }

    return actual;
}
