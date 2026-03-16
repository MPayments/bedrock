import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { requisiteKindEnum } from "./enums";

export const requisiteProviders = pgTable(
  "requisite_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: requisiteKindEnum("kind").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    country: text("country"),
    address: text("address"),
    contact: text("contact"),
    bic: text("bic"),
    swift: text("swift"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("requisite_providers_kind_idx").on(table.kind),
    index("requisite_providers_country_idx").on(table.country),
  ],
);

export type RequisiteProviderRow = typeof requisiteProviders.$inferSelect;
export type RequisiteProviderInsert = typeof requisiteProviders.$inferInsert;
