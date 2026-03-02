import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { books } from "@bedrock/ledger/schema";
import { bookAccountInstances } from "@bedrock/ledger/schema";

const operationalAccountsRef = pgTable("operational_accounts", {
  id: uuid("id").primaryKey(),
});

export const chartAccountKindEnum = pgEnum("chart_account_kind", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "active_passive",
]);

export const chartNormalSideEnum = pgEnum("chart_normal_side", [
  "debit",
  "credit",
  "both",
]);

export const dimensionModeEnum = pgEnum("dimension_mode", [
  "required",
  "optional",
  "forbidden",
]);

export const dimensionPolicyScopeEnum = pgEnum("dimension_policy_scope", [
  "line",
  "debit",
  "credit",
]);

export const chartTemplateAccounts = pgTable(
  "chart_template_accounts",
  {
    accountNo: text("account_no").primaryKey(),
    name: text("name").notNull(),
    kind: chartAccountKindEnum("kind").notNull(),
    normalSide: chartNormalSideEnum("normal_side").notNull(),
    postingAllowed: boolean("posting_allowed").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    parentAccountNo: text("parent_account_no"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    check("chart_template_account_no_fmt", sql`${t.accountNo} ~ '^[0-9]{4}$'`),
    index("chart_template_parent_idx").on(t.parentAccountNo),
  ],
);

export const chartAccountDimensionPolicy = pgTable(
  "chart_account_dimension_policy",
  {
    accountNo: text("account_no")
      .notNull()
      .references(() => chartTemplateAccounts.accountNo, {
        onDelete: "cascade",
      }),
    dimensionKey: text("dimension_key").notNull(),
    mode: dimensionModeEnum("mode").notNull().default("required"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.accountNo, t.dimensionKey] })],
);

export const postingCodeDimensionPolicy = pgTable(
  "posting_code_dimension_policy",
  {
    postingCode: text("posting_code").notNull(),
    dimensionKey: text("dimension_key").notNull(),
    required: boolean("required").notNull().default(true),
    scope: dimensionPolicyScopeEnum("scope").notNull().default("line"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.postingCode, t.dimensionKey] })],
);

export const correspondenceRules = pgTable(
  "correspondence_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postingCode: text("posting_code").notNull(),
    debitAccountNo: text("debit_account_no")
      .notNull()
      .references(() => chartTemplateAccounts.accountNo),
    creditAccountNo: text("credit_account_no")
      .notNull()
      .references(() => chartTemplateAccounts.accountNo),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("correspondence_rule_uq").on(
      t.postingCode,
      t.debitAccountNo,
      t.creditAccountNo,
    ),
    index("correspondence_rule_lookup_idx").on(
      t.postingCode,
      t.debitAccountNo,
      t.creditAccountNo,
      t.enabled,
    ),
  ],
);

export const accountingPackVersions = pgTable(
  "accounting_pack_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packKey: text("pack_key").notNull(),
    version: integer("version").notNull(),
    checksum: text("checksum").notNull(),
    compiledJson: jsonb("compiled_json")
      .$type<Record<string, unknown>>()
      .notNull(),
    compiledAt: timestamp("compiled_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("accounting_pack_versions_pack_version_uq").on(
      t.packKey,
      t.version,
    ),
    uniqueIndex("accounting_pack_versions_checksum_uq").on(t.checksum),
    index("accounting_pack_versions_pack_compiled_idx").on(t.packKey, t.compiledAt),
  ],
);

export const accountingPackAssignments = pgTable(
  "accounting_pack_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeType: text("scope_type").notNull().default("book"),
    scopeId: text("scope_id").notNull(),
    packChecksum: text("pack_checksum")
      .notNull()
      .references(() => accountingPackVersions.checksum, {
        onDelete: "cascade",
      }),
    effectiveAt: timestamp("effective_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("accounting_pack_assignments_scope_effective_idx").on(
      t.scopeType,
      t.scopeId,
      t.effectiveAt,
    ),
  ],
);

export const operationalAccountBindings = pgTable(
  "operational_account_bindings",
  {
    operationalAccountId: uuid("operational_account_id")
      .primaryKey()
      .references(() => operationalAccountsRef.id, { onDelete: "cascade" }),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    bookAccountInstanceId: uuid("book_account_instance_id")
      .notNull()
      .references(() => bookAccountInstances.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("operational_account_binding_book_idx").on(t.bookId),
    index("operational_account_binding_instance_idx").on(
      t.bookAccountInstanceId,
    ),
  ],
);

export type ChartTemplateAccount = typeof chartTemplateAccounts.$inferSelect;
export type ChartAccountDimensionPolicyRow =
  typeof chartAccountDimensionPolicy.$inferSelect;
export type PostingCodeDimensionPolicyRow =
  typeof postingCodeDimensionPolicy.$inferSelect;
export type CorrespondenceRule = typeof correspondenceRules.$inferSelect;
export type AccountingPackVersion = typeof accountingPackVersions.$inferSelect;
export type AccountingPackAssignment =
  typeof accountingPackAssignments.$inferSelect;
export type OperationalAccountBinding =
  typeof operationalAccountBindings.$inferSelect;

export type OperationalAccountBindingInsert =
  typeof operationalAccountBindings.$inferInsert;

export const schema = {
  chartTemplateAccounts,
  chartAccountDimensionPolicy,
  postingCodeDimensionPolicy,
  correspondenceRules,
  accountingPackVersions,
  accountingPackAssignments,
  operationalAccountBindings,
};
