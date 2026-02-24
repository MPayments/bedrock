import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";

import { counterparties } from "./counterparties";
import { accountProviders } from "./account-providers";
import { currencies } from "../currencies";

export type Account = typeof accounts.$inferSelect;
export type AccountInsert = typeof accounts.$inferInsert;

export const accounts = pgTable(
    "accounts",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        counterpartyId: uuid("counterparty_id").notNull().references(() => counterparties.id, { onDelete: "cascade" }),

        currencyId: uuid("currency_id").notNull().references(() => currencies.id),

        accountProviderId: uuid("account_provider_id").notNull().references(() => accountProviders.id),

        label: text("label").notNull(),
        accountNo: text("account_no"),
        corrAccount: text("corr_account"),
        address: text("address"),
        iban: text("iban"),

        stableKey: text("stable_key").notNull(),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
    },
    (t) => ([
        uniqueIndex("accounts_counterparty_stable_uq").on(t.counterpartyId, t.stableKey),
        index("accounts_counterparty_cur_idx").on(t.counterpartyId, t.currencyId),
    ]),
);
