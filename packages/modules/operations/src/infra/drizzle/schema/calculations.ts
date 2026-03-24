import { sql } from "drizzle-orm";
import { integer, pgTable, serial, text, uuid } from "drizzle-orm/pg-core";

import { fxQuotes } from "@bedrock/treasury/schema";

import { opsApplications } from "./applications";

// --- ops_calculations (was: calculations) ---

export const opsCalculations = pgTable("ops_calculations", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id")
    .notNull()
    .references(() => opsApplications.id),
  currencyCode: text("currency_code").notNull(),
  originalAmount: text("original_amount").notNull(),
  feePercentage: text("fee_percentage").notNull(),
  feeAmount: text("fee_amount").notNull(),
  totalAmount: text("total_amount").notNull(),
  rateSource: text("rate_source").notNull(),
  rate: text("rate").notNull(),
  additionalExpensesCurrencyCode: text("additional_expenses_currency_code"),
  additionalExpenses: text("additional_expenses").notNull(),
  baseCurrencyCode: text("base_currency_code").default("RUB").notNull(),
  feeAmountInBase: text("fee_amount_in_base").notNull(),
  totalInBase: text("total_in_base").notNull(),
  additionalExpensesInBase: text("additional_expenses_in_base").notNull(),
  totalWithExpensesInBase: text("total_with_expenses_in_base").notNull(),
  calculationTimestamp: text("calculation_timestamp").notNull(),
  sentToClient: integer("sent_to_client").default(0).notNull(),
  status: text("status").default("draft").notNull(),
  // FK bridge to bedrock treasury
  fxQuoteId: uuid("fx_quote_id").references(() => fxQuotes.id),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});
