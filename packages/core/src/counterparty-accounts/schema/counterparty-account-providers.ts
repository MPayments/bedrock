import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { counterpartyCountryCodeEnum } from "../../counterparties/schema";

export const accountProviderTypeEnum = pgEnum("account_provider_type", [
  "bank",
  "exchange",
  "blockchain",
  "custodian",
]);

export type CounterpartyAccountProvider =
  typeof counterpartyAccountProviders.$inferSelect;
export type CounterpartyAccountProviderInsert =
  typeof counterpartyAccountProviders.$inferInsert;

export const counterpartyAccountProviders = pgTable(
  "counterparty_account_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: accountProviderTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    address: text("address"),
    contact: text("contact"),
    bic: text("bic"),
    swift: text("swift"),
    country: counterpartyCountryCodeEnum("country").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [uniqueIndex("counterparty_account_providers_name_uq").on(t.name)],
);
