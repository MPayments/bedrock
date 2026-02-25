import { sql } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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
  },
});

export type BookAccount = typeof bookAccounts.$inferSelect;
export type BookAccountInsert = typeof bookAccounts.$inferInsert;

export const bookAccounts = pgTable(
  "book_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull(),

    accountNo: text("account_no").notNull(),
    currency: text("currency").notNull(),

    tbLedger: bigint("tb_ledger", { mode: "number" }).notNull(),
    tbAccountId: uint128("tb_account_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("book_accounts_org_no_currency_uq").on(
      t.orgId,
      t.accountNo,
      t.currency,
    ),
    uniqueIndex("book_accounts_org_tb_uq").on(t.orgId, t.tbLedger, t.tbAccountId),
    index("book_accounts_org_currency_idx").on(t.orgId, t.currency),
  ],
);
