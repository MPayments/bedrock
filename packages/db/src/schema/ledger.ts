import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, uniqueIndex, index, bigint, customType } from "drizzle-orm/pg-core";

export const uint128 = customType<{ data: bigint; driverData: string }>({
  dataType() {
    return "numeric(39,0)";
  },
  toDriver(v: bigint) {
    if (v < 0n) throw new Error("uint128 must be >= 0");
    return v.toString(10);
  },
  fromDriver(v: string) {
    return BigInt(v);
  }
});

export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),

    key: text("key").notNull(),
    currency: text("currency").notNull(),

    tbLedger: bigint("tb_ledger", { mode: "number" }).notNull(),
    tbAccountId: uint128("tb_account_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`)
  },
  (t) => ([
    uniqueIndex("ledger_accounts_org_key_uq").on(t.orgId, t.tbLedger, t.key),
    index("ledger_accounts_org_cur_idx").on(t.orgId, t.currency)
  ])
);
