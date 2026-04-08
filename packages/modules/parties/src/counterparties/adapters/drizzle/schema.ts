import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { COUNTRY_ALPHA2_CODES } from "@bedrock/shared/reference-data/countries/contracts";

import { customers } from "../../../customers/adapters/drizzle/schema";
import { PARTY_KIND_VALUES } from "../../../shared/domain/party-kind";
import { COUNTERPARTY_RELATIONSHIP_KIND_VALUES } from "../../domain/relationship-kind";

export const counterpartyKindEnum = pgEnum(
  "counterparty_kind",
  PARTY_KIND_VALUES,
);

export const counterpartyCountryCodeEnum = pgEnum(
  "counterparty_country_code",
  COUNTRY_ALPHA2_CODES,
);

export const counterpartyRelationshipKindEnum = pgEnum(
  "counterparty_relationship_kind",
  COUNTERPARTY_RELATIONSHIP_KIND_VALUES,
);

export const counterparties = pgTable("counterparties", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalRef: text("external_ref"),
  customerId: uuid("customer_id").references(() => customers.id),
  relationshipKind: counterpartyRelationshipKindEnum("relationship_kind")
    .notNull()
    .default("external"),
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

export const customerCounterpartyAssignments = pgTable(
  "customer_counterparty_assignments",
  {
    counterpartyId: uuid("counterparty_id")
      .primaryKey()
      .references(() => counterparties.id, { onDelete: "cascade" }),
    subAgentCounterpartyId: uuid("sub_agent_counterparty_id").references(
      () => counterparties.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("customer_counterparty_assignments_sub_agent_idx").on(
      table.subAgentCounterpartyId,
    ),
  ],
);

export const counterpartyGroups = pgTable(
  "counterparty_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: uuid("parent_id"),
    customerId: uuid("customer_id").references(() => customers.id, {
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
  counterparties,
  customerCounterpartyAssignments,
  counterpartyGroups,
  counterpartyGroupMemberships,
  counterpartyRelationshipKindEnum,
};

export type CounterpartyRow = typeof counterparties.$inferSelect;
export type CounterpartyGroupRow = typeof counterpartyGroups.$inferSelect;
export type CustomerCounterpartyAssignmentRow =
  typeof customerCounterpartyAssignments.$inferSelect;
