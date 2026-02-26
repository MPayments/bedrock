import { sql } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  jsonb,
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

export type Dimensions = Record<string, string>;

export type BookAccountInstance = typeof bookAccountInstances.$inferSelect;
export type BookAccountInstanceInsert = typeof bookAccountInstances.$inferInsert;

export const bookAccountInstances = pgTable(
  "book_account_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookOrgId: uuid("book_org_id").notNull(),

    accountNo: text("account_no").notNull(),
    currency: text("currency").notNull(),

    dimensions: jsonb("dimensions").$type<Dimensions>().notNull().default({}),
    dimensionsHash: text("dimensions_hash").notNull(),

    tbLedger: bigint("tb_ledger", { mode: "number" }).notNull(),
    tbAccountId: uint128("tb_account_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("book_account_instances_uq").on(
      t.bookOrgId,
      t.accountNo,
      t.currency,
      t.dimensionsHash,
    ),
    uniqueIndex("book_account_instances_tb_uq").on(
      t.bookOrgId,
      t.tbLedger,
      t.tbAccountId,
    ),
    index("book_account_instances_org_currency_idx").on(t.bookOrgId, t.currency),
    index("book_account_instances_account_no_idx").on(t.accountNo),
  ],
);
