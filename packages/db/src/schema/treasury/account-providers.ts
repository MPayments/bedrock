import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { counterpartyCountryCodeEnum } from "./counterparties";

export const accountProviderTypeEnum = pgEnum("account_provider_type", [
    "bank",
    "exchange",
    "blockchain",
    "custodian",
]);

export type AccountProvider = typeof accountProviders.$inferSelect;
export type AccountProviderInsert = typeof accountProviders.$inferInsert;

export const accountProviders = pgTable(
    "account_providers",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        type: accountProviderTypeEnum("type").notNull(),
        name: text("name").notNull(),
        address: text("address"),
        contact: text("contact"),
        bic: text("bic"),
        swift: text("swift"),
        country: counterpartyCountryCodeEnum("country").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`).$onUpdateFn(() => new Date()),
    },
    (t) => [
        uniqueIndex("account_providers_name_uq").on(t.name),
    ],
);
