import { sql } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { schema as ledgerSchema } from "@bedrock/ledger/schema";
import { COUNTRY_ALPHA2_CODES } from "@bedrock/shared/reference-data/countries/contracts";

import { PARTY_KIND_VALUES } from "../../domain/party-kind";

export const ledgerBooks = ledgerSchema.books;

export const partyKindEnum = pgEnum("party_kind", PARTY_KIND_VALUES);

export const partyCountryCodeEnum = pgEnum(
  "party_country_code",
  COUNTRY_ALPHA2_CODES,
);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalRef: text("external_ref"),
  shortName: text("short_name").notNull(),
  fullName: text("full_name").notNull(),
  description: text("description"),
  country: text("country"),
  kind: partyKindEnum("kind").notNull().default("legal_entity"),
  isActive: boolean("is_active").notNull().default(true),
  signatureKey: text("signature_key"),
  sealKey: text("seal_key"),
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
