import { eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@repo/db";
import { ledgerAccounts, type NewLedgerAccountRow, type LedgerAccountRow } from "@repo/db/schema";
import type { AccountRef } from "./contract.js";
import { accountRefKey } from "./contract.js";

export type AccountStore = ReturnType<typeof createPgAccountStore>;

export interface AccountMapping {
  tbAccountId: bigint;
  tbLedger: number;
}

export function createPgAccountStore(db: Database) {
  const get = async (ref: AccountRef): Promise<AccountMapping | null> => {
    const key = accountRefKey(ref);
    const rows = await db
      .select({
        tbAccountId: ledgerAccounts.tbAccountId,
        tbLedger: ledgerAccounts.tbLedger,
      })
      .from(ledgerAccounts)
      .where(eq(ledgerAccounts.refKey, key))
      .limit(1);

    return rows[0] ?? null;
  };

  const getMany = async (refs: AccountRef[]): Promise<Map<string, AccountMapping>> => {
    if (refs.length === 0) return new Map();

    // Dedupe keys to avoid huge IN() on repeated refs
    const keySet = new Set(refs.map(accountRefKey));
    const keys = [...keySet];

    const rows = await db
      .select({
        refKey: ledgerAccounts.refKey,
        tbAccountId: ledgerAccounts.tbAccountId,
        tbLedger: ledgerAccounts.tbLedger,
      })
      .from(ledgerAccounts)
      .where(inArray(ledgerAccounts.refKey, keys));

    const result = new Map<string, AccountMapping>();
    for (const row of rows) {
      result.set(row.refKey, { tbAccountId: row.tbAccountId, tbLedger: row.tbLedger });
    }
    return result;
  };

  /**
   * Upsert mapping and RETURN the stored mapping in one query.
   * We do a "no-op update" on conflict to be able to RETURN existing row.
   * created is detected via (xmax = 0) trick.
   */
  const upsert = async (
    ref: AccountRef,
    mapping: AccountMapping
  ): Promise<{ created: boolean; mapping: AccountMapping }> => {
    const key = accountRefKey(ref);

    const row: NewLedgerAccountRow = {
      refKey: key,
      kind: ref.kind,
      currency: ref.currency,
      tbAccountId: mapping.tbAccountId,
      tbLedger: mapping.tbLedger,
      customerId: ref.kind === "customer" ? ref.customerId : null,
      internalName: ref.kind === "internal" ? ref.name : null,
      glCode: ref.kind === "global_ledger" ? ref.code : null,
    };

    const [ret] = await db
      .insert(ledgerAccounts)
      .values(row)
      .onConflictDoUpdate({
        target: ledgerAccounts.refKey,
        // No-op update to enable RETURNING existing row
        set: { refKey: sql`excluded.ref_key` },
      })
      .returning({
        tbAccountId: ledgerAccounts.tbAccountId,
        tbLedger: ledgerAccounts.tbLedger,
        created: sql<boolean>`(xmax = 0)`.as("created"),
      });

    if (!ret) {
      throw new Error(`Failed to upsert ledger mapping for refKey=${key}`);
    }

    return {
      created: ret.created,
      mapping: { tbAccountId: ret.tbAccountId, tbLedger: ret.tbLedger },
    };
  };

  const list = async (): Promise<LedgerAccountRow[]> => db.select().from(ledgerAccounts);

  return { get, getMany, upsert, list };
}
