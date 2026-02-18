import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid, bigint, jsonb } from "drizzle-orm/pg-core";

import { currencies } from "../currencies";

export type FeeCalcMethod = "bps" | "fixed";
export type FeeSettlementMode = "in_ledger" | "separate_payment_order";
export type FeeOperationKind =
    | "fx_quote"
    | "fx_execution"
    | "funding"
    | "payout"
    | "internal_transfer"
    | "external_transfer"
    | "custom";

export const feeRules = pgTable(
    "fee_rules",
    {
        id: uuid("id").primaryKey().defaultRandom(),

        name: text("name").notNull(),
        operationKind: text("operation_kind").$type<FeeOperationKind>().notNull(),
        feeKind: text("fee_kind").notNull(),

        calcMethod: text("calc_method").$type<FeeCalcMethod>().notNull().default("bps"),
        bps: integer("bps"),
        fixedAmountMinor: bigint("fixed_amount_minor", { mode: "bigint" }),
        fixedCurrencyId: uuid("fixed_currency_id").references(() => currencies.id),

        settlementMode: text("settlement_mode").$type<FeeSettlementMode>().notNull().default("in_ledger"),

        dealDirection: text("deal_direction"),
        dealForm: text("deal_form"),
        fromCurrencyId: uuid("from_currency_id").references(() => currencies.id),
        toCurrencyId: uuid("to_currency_id").references(() => currencies.id),

        priority: integer("priority").notNull().default(100),
        isActive: boolean("is_active").notNull().default(true),

        effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().default(sql`now()`),
        effectiveTo: timestamp("effective_to", { withTimezone: true }),

        debitAccountKey: text("debit_account_key"),
        creditAccountKey: text("credit_account_key"),
        transferCode: integer("transfer_code"),
        memo: text("memo"),
        metadata: jsonb("metadata").$type<Record<string, string>>(),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    },
    (t) => [
        index("fee_rules_op_active_priority_idx").on(t.operationKind, t.isActive, t.priority),
        index("fee_rules_effective_idx").on(t.effectiveFrom, t.effectiveTo),
    ]
);
