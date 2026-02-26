import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { bookAccounts } from "./ledger/ledger";
import { operationalAccounts } from "./treasury/accounts";

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

export const chartAnalyticTypeEnum = pgEnum("chart_analytic_type", [
  "counterparty_id",
  "customer_id",
  "order_id",
  "operational_account_id",
  "transfer_id",
  "quote_id",
  "fee_bucket",
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

export const chartTemplateAccountAnalytics = pgTable(
  "chart_template_account_analytics",
  {
    accountNo: text("account_no")
      .notNull()
      .references(() => chartTemplateAccounts.accountNo, {
        onDelete: "cascade",
      }),
    analyticType: chartAnalyticTypeEnum("analytic_type").notNull(),
    required: boolean("required").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.accountNo, t.analyticType] })],
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

export const operationalAccountsBookBindings = pgTable(
  "operational_accounts_book_bindings",
  {
    operationalAccountId: uuid("operational_account_id")
      .primaryKey()
      .references(() => operationalAccounts.id, { onDelete: "cascade" }),
    bookAccountId: uuid("book_account_id")
      .notNull()
      .references(() => bookAccounts.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (t) => [
    index("operational_accounts_book_binding_book_idx").on(t.bookAccountId),
  ],
);

export type ChartTemplateAccount = typeof chartTemplateAccounts.$inferSelect;
export type ChartTemplateAccountAnalytic =
  typeof chartTemplateAccountAnalytics.$inferSelect;
export type CorrespondenceRule = typeof correspondenceRules.$inferSelect;
export type OperationalAccountsBookBinding =
  typeof operationalAccountsBookBindings.$inferSelect;
