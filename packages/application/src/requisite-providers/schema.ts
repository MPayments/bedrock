import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { requisiteKindEnum } from "../requisites/shared";

export type RequisiteProvider = typeof requisiteProviders.$inferSelect;
export type RequisiteProviderInsert = typeof requisiteProviders.$inferInsert;

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
  (t) => [
    index("requisite_providers_kind_idx").on(t.kind),
    index("requisite_providers_country_idx").on(t.country),
  ],
);

export const schema = {
  requisiteProviders,
};
