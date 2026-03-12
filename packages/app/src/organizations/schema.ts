import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import {
  counterpartyCountryCodeEnum,
  counterpartyKindEnum,
} from "../counterparties/schema";

export type Organization = typeof organizations.$inferSelect;
export type OrganizationInsert = typeof organizations.$inferInsert;

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id"),
  shortName: text("short_name").notNull(),
  fullName: text("full_name").notNull(),
  description: text("description"),
  country: counterpartyCountryCodeEnum("country"),
  kind: counterpartyKindEnum("kind").notNull().default("legal_entity"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`)
    .$onUpdateFn(() => new Date()),
});

export const schema = {
  organizations,
};
