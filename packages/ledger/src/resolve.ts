import { and, eq } from "drizzle-orm";
import { schema } from "@repo/db/schema";
import { type Database } from "@repo/db";
import { tbAccountIdFor } from "./ids";
import { AccountFlags, makeTbAccount, tbCreateAccountsOrThrow, type TbClient } from "./tb";
import { AccountMappingConflictError } from "./errors";

function accountCodeFromKey(key: string): number {
    let x = 0;
    for (let i = 0; i < key.length; i++) x = (x + key.charCodeAt(i) * (i + 1)) & 0xffff;
    return x || 1;
}

function tbAccountFlagsForKey(key: string): number {
    const normalized = key.toLowerCase();

    // Credit-normal accounts (liabilities/revenue): debits cannot exceed credits.
    if (
        normalized.includes(":customerwallet:") ||
        normalized.includes(":payoutobligation:") ||
        normalized.includes(":orderpayin:") ||
        normalized.includes(":revenue:")
    ) {
        return AccountFlags.debits_must_not_exceed_credits;
    }

    // Debit-normal accounts (assets/cash): credits cannot exceed debits.
    if (
        normalized.includes(":bank:") ||
        normalized.includes(":treasurypool:")
    ) {
        return AccountFlags.credits_must_not_exceed_debits;
    }

    // Unknown account roles remain unconstrained until explicit policy is configured.
    return 0;
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
    const code = accountCodeFromKey(p.key);
    const flags = tbAccountFlagsForKey(p.key);

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

        // Self-heal on retries: if previous attempt inserted mapping but failed before
        // creating TB account, this idempotent create will bring TB in sync.
        await tbCreateAccountsOrThrow(p.tb, [makeTbAccount(actual, p.tbLedger, code, flags)]);
        return actual;
    }

    // Account doesn't exist - use DB-first approach to prevent TOCTOU race:
    // 1. Insert into DB first (establishes ownership via unique constraint)
    // 2. Then create in TigerBeetle (idempotent operation)
    // This ensures DB is always the source of truth and races are handled by DB constraints

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
        await tbCreateAccountsOrThrow(p.tb, [makeTbAccount(expected, p.tbLedger, code, flags)]);
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
