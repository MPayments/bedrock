import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { currencies } from "../currencies";
import { accounts } from "./accounts";

export type AccountLedgerBinding = typeof accountLedgerBindings.$inferSelect;
export type AccountLedgerBindingInsert = typeof accountLedgerBindings.$inferInsert;

export const accountLedgerBindings = pgTable(
    "account_ledger_bindings",
    {
        accountId: uuid("account_id").primaryKey().references(() => accounts.id, { onDelete: "cascade" }),
        ledgerOrgId: uuid("ledger_org_id").notNull(),
        ledgerKey: text("ledger_key").notNull(),
        currencyId: uuid("currency_id").notNull().references(() => currencies.id),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
    },
    (t) => [
        uniqueIndex("account_ledger_bindings_org_key_uq").on(t.ledgerOrgId, t.ledgerKey),
        index("account_ledger_bindings_currency_idx").on(t.currencyId),
    ],
);
