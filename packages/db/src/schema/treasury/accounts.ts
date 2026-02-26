import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { operationalAccountProviders } from "./account-providers";
import { counterparties } from "./counterparties";
import { currencies } from "../currencies";

export type OperationalAccount = typeof operationalAccounts.$inferSelect;
export type OperationalAccountInsert = typeof operationalAccounts.$inferInsert;
export type Account = OperationalAccount;
export type AccountInsert = OperationalAccountInsert;

export const operationalAccounts = pgTable(
  "operational_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    counterpartyId: uuid("counterparty_id")
      .notNull()
      .references(() => counterparties.id, { onDelete: "cascade" }),

    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),

    accountProviderId: uuid("account_provider_id")
      .notNull()
      .references(() => operationalAccountProviders.id),

    label: text("label").notNull(),
    description: text("description"),
    accountNo: text("account_no"),
    corrAccount: text("corr_account"),
    address: text("address"),
    iban: text("iban"),

    stableKey: text("stable_key").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("operational_accounts_counterparty_stable_uq").on(
      t.counterpartyId,
      t.stableKey,
    ),
    index("operational_accounts_counterparty_cur_idx").on(
      t.counterpartyId,
      t.currencyId,
    ),
  ],
);

export const accounts = operationalAccounts;
