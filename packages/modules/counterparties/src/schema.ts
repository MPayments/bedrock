import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { customers } from "@bedrock/customers/schema";
import {
  partyCountryCodeEnum,
  partyKindEnum,
} from "@bedrock/party-types/schema";

export const customersRef = customers;

export const counterpartyKindEnum = partyKindEnum;
export const counterpartyCountryCodeEnum = partyCountryCodeEnum;

export const counterparties = pgTable("counterparties", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id"),
  customerId: uuid("customer_id").references(() => customersRef.id),
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

export const counterpartyGroups = pgTable(
  "counterparty_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: uuid("parent_id"),
    customerId: uuid("customer_id").references(() => customersRef.id, {
      onDelete: "set null",
    }),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    foreignKey({
      name: "counterparty_groups_parent_id_fk",
      columns: [table.parentId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
    uniqueIndex("counterparty_groups_code_uq").on(table.code),
    index("counterparty_groups_parent_idx").on(table.parentId),
  ],
);

export const counterpartyGroupMemberships = pgTable(
  "counterparty_group_memberships",
  {
    counterpartyId: uuid("counterparty_id")
      .notNull()
      .references(() => counterparties.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => counterpartyGroups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    primaryKey({
      name: "counterparty_group_memberships_pk",
      columns: [table.counterpartyId, table.groupId],
    }),
    index("counterparty_group_memberships_group_idx").on(table.groupId),
  ],
);

export const schema = {
  customersRef,
  counterparties,
  counterpartyGroups,
  counterpartyGroupMemberships,
};
