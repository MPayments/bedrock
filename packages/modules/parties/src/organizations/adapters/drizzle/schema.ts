import { sql } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { COUNTRY_ALPHA2_CODES } from "@bedrock/shared/reference-data/countries/contracts";

import { PARTY_KIND_VALUES } from "../../domain/party-kind";

export const partyKindEnum = pgEnum("party_kind", PARTY_KIND_VALUES);

export const partyCountryCodeEnum = pgEnum(
  "party_country_code",
  COUNTRY_ALPHA2_CODES,
);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id"),
  shortName: text("short_name").notNull(),
  fullName: text("full_name").notNull(),
  description: text("description"),
  country: partyCountryCodeEnum("country"),
  kind: partyKindEnum("kind").notNull().default("legal_entity"),
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

export type OrganizationRow = typeof organizations.$inferSelect;
