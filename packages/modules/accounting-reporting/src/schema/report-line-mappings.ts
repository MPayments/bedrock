import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { chartTemplateAccounts } from "@bedrock/accounting/schema";

export type AccountingReportKind =
  | "balance_sheet"
  | "income_statement"
  | "cash_flow_direct"
  | "cash_flow_indirect"
  | "fx_revaluation"
  | "fee_revenue";

export const accountingReportLineMappings = pgTable(
  "accounting_report_line_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    standard: text("standard").notNull().default("ifrs"),
    reportKind: text("report_kind").$type<AccountingReportKind>().notNull(),
    lineCode: text("line_code").notNull(),
    lineLabel: text("line_label").notNull(),
    section: text("section").notNull(),
    accountNo: text("account_no")
      .notNull()
      .references(() => chartTemplateAccounts.accountNo, { onDelete: "cascade" }),
    signMultiplier: integer("sign_multiplier").notNull().default(1),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("accounting_report_line_mappings_uq").on(
      t.standard,
      t.reportKind,
      t.lineCode,
      t.accountNo,
      t.effectiveFrom,
    ),
    index("accounting_report_line_mappings_lookup_idx").on(
      t.reportKind,
      t.accountNo,
      t.effectiveFrom,
      t.effectiveTo,
    ),
  ],
);

export type AccountingReportLineMapping =
  typeof accountingReportLineMappings.$inferSelect;

