import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";

import { counterparties } from "./counterparties";
import { currencies } from "../currencies";

export type Rail = "bank" | "swift" | "sepa" | "crypto" | "cash";

export const bankAccounts = pgTable(
    "bank_accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        counterpartyId: uuid("counterparty_id").notNull().references(() => counterparties.id, { onDelete: "cascade" }),

        rail: text("rail").$type<Rail>().notNull().default("bank"),
        currencyId: uuid("currency_id").notNull().references(() => currencies.id),

        label: text("label").notNull(),
        accountNo: text("account_no"),
        iban: text("iban"),
        bicSwift: text("bic_swift"),
        bankName: text("bank_name"),

        stableKey: text("stable_key").notNull(),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    },
    (t) => ([
        uniqueIndex("bank_accounts_counterparty_stable_uq").on(t.counterpartyId, t.stableKey),
        index("bank_accounts_counterparty_cur_idx").on(t.counterpartyId, t.currencyId),
    ]),
);
