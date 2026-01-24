import { pgTable, text, integer, timestamp, customType, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";

/**
 * Custom type for TigerBeetle's 128-bit account IDs.
 * Stored as numeric(39,0) in Postgres to preserve full precision.
 */
export const uint128 = customType<{ data: bigint; driverData: string }>({
  dataType() {
    return "numeric(39,0)";
  },
  toDriver(value) {
    return value.toString(10);
  },
  fromDriver(value) {
    return BigInt(value);
  },
});

export const ledgerAccountKindEnum = pgEnum("ledger_account_kind", [
  "customer",
  "internal",
  "global_ledger",
]);

/**
 * Mapping table: business refs → TigerBeetle account IDs.
 * This is the source of truth for which TB accounts exist.
 */
export const ledgerAccounts = pgTable(
  "ledger_accounts",
  {
    refKey: text("ref_key").primaryKey(), // stable key derived from AccountRef (includes org)
    organizationId: text("organization_id").notNull(), // tenant isolation
    kind: ledgerAccountKindEnum("kind").notNull(),
    currency: text("currency").notNull(),

    // denormalized fields for debugging / filtering
    customerId: text("customer_id"),
    internalName: text("internal_name"),
    glCode: text("gl_code"),

    tbAccountId: uint128("tb_account_id").notNull(),
    tbLedger: integer("tb_ledger").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("ledger_accounts_tb_account_id_uq").on(t.tbAccountId)]
);

export type LedgerAccountRow = typeof ledgerAccounts.$inferSelect;
export type NewLedgerAccountRow = typeof ledgerAccounts.$inferInsert;
