import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { currencies } from "@bedrock/currencies/schema";
import { fxQuotes } from "@bedrock/treasury/schema";

import {
  CALCULATION_LINE_KIND_VALUES,
  CALCULATION_RATE_SOURCE_VALUES,
} from "../../domain/constants";

export const calculationRateSourceEnum = pgEnum(
  "calculation_rate_source",
  CALCULATION_RATE_SOURCE_VALUES,
);
export const calculationLineKindEnum = pgEnum(
  "calculation_line_kind",
  CALCULATION_LINE_KIND_VALUES,
);

export const calculations = pgTable(
  "calculations",
  {
    id: uuid("id").primaryKey(),
    currentSnapshotId: uuid("current_snapshot_id").references(
      (): AnyPgColumn => calculationSnapshots.id,
      {
        onDelete: "set null",
      },
    ),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("calculations_current_snapshot_idx").on(table.currentSnapshotId),
    uniqueIndex("calculations_current_snapshot_uq")
      .on(table.currentSnapshotId)
      .where(sql`${table.currentSnapshotId} is not null`),
  ],
);

export const calculationSnapshots = pgTable(
  "calculation_snapshots",
  {
    id: uuid("id").primaryKey(),
    calculationId: uuid("calculation_id")
      .notNull()
      .references(() => calculations.id, { onDelete: "cascade" }),
    snapshotNumber: integer("snapshot_number").notNull(),
    calculationCurrencyId: uuid("calculation_currency_id")
      .notNull()
      .references(() => currencies.id),
    originalAmountMinor: bigint("original_amount_minor", {
      mode: "bigint",
    }).notNull(),
    feeBps: bigint("fee_bps", { mode: "bigint" }).notNull(),
    feeAmountMinor: bigint("fee_amount_minor", { mode: "bigint" }).notNull(),
    totalAmountMinor: bigint("total_amount_minor", { mode: "bigint" }).notNull(),
    baseCurrencyId: uuid("base_currency_id")
      .notNull()
      .references(() => currencies.id),
    feeAmountInBaseMinor: bigint("fee_amount_in_base_minor", {
      mode: "bigint",
    }).notNull(),
    totalInBaseMinor: bigint("total_in_base_minor", {
      mode: "bigint",
    }).notNull(),
    additionalExpensesCurrencyId: uuid("additional_expenses_currency_id").references(
      () => currencies.id,
    ),
    additionalExpensesAmountMinor: bigint("additional_expenses_amount_minor", {
      mode: "bigint",
    }).notNull(),
    additionalExpensesInBaseMinor: bigint("additional_expenses_in_base_minor", {
      mode: "bigint",
    }).notNull(),
    totalWithExpensesInBaseMinor: bigint(
      "total_with_expenses_in_base_minor",
      {
        mode: "bigint",
      },
    ).notNull(),
    rateSource: calculationRateSourceEnum("rate_source").notNull(),
    rateNum: bigint("rate_num", { mode: "bigint" }).notNull(),
    rateDen: bigint("rate_den", { mode: "bigint" }).notNull(),
    additionalExpensesRateSource: calculationRateSourceEnum(
      "additional_expenses_rate_source",
    ),
    additionalExpensesRateNum: bigint("additional_expenses_rate_num", {
      mode: "bigint",
    }),
    additionalExpensesRateDen: bigint("additional_expenses_rate_den", {
      mode: "bigint",
    }),
    calculationTimestamp: timestamp("calculation_timestamp", {
      withTimezone: true,
    }).notNull(),
    fxQuoteId: uuid("fx_quote_id").references(() => fxQuotes.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("calculation_snapshots_calc_snapshot_uq").on(
      table.calculationId,
      table.snapshotNumber,
    ),
    index("calculation_snapshots_calc_idx").on(table.calculationId),
    index("calculation_snapshots_fx_quote_idx").on(table.fxQuoteId),
    check(
      "calculation_snapshots_rate_positive_chk",
      sql`${table.rateNum} > 0 and ${table.rateDen} > 0`,
    ),
    check(
      "calculation_snapshots_additional_rate_shape_chk",
      sql`(
        ${table.additionalExpensesRateSource} is null
        and ${table.additionalExpensesRateNum} is null
        and ${table.additionalExpensesRateDen} is null
      ) or (
        ${table.additionalExpensesRateSource} is not null
        and ${table.additionalExpensesRateNum} is not null
        and ${table.additionalExpensesRateDen} is not null
        and ${table.additionalExpensesRateNum} > 0
        and ${table.additionalExpensesRateDen} > 0
      )`,
    ),
    check(
      "calculation_snapshots_additional_rate_currency_chk",
      sql`(
        (
          ${table.additionalExpensesCurrencyId} is null
          or ${table.additionalExpensesCurrencyId} = ${table.baseCurrencyId}
        )
        and ${table.additionalExpensesRateSource} is null
        and ${table.additionalExpensesRateNum} is null
        and ${table.additionalExpensesRateDen} is null
      ) or (
        ${table.additionalExpensesCurrencyId} is not null
        and ${table.additionalExpensesCurrencyId} <> ${table.baseCurrencyId}
      )`,
    ),
    check(
      "calculation_snapshots_fx_quote_consistency_chk",
      sql`(
        ${table.rateSource} = 'fx_quote'
        and ${table.fxQuoteId} is not null
      ) or (
        ${table.rateSource} <> 'fx_quote'
        and ${table.fxQuoteId} is null
      )`,
    ),
  ],
);

export const calculationLines = pgTable(
  "calculation_lines",
  {
    id: uuid("id").primaryKey(),
    calculationSnapshotId: uuid("calculation_snapshot_id")
      .notNull()
      .references(() => calculationSnapshots.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    kind: calculationLineKindEnum("kind").notNull(),
    currencyId: uuid("currency_id")
      .notNull()
      .references(() => currencies.id),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("calculation_lines_snapshot_idx_uq").on(
      table.calculationSnapshotId,
      table.idx,
    ),
    uniqueIndex("calculation_lines_snapshot_kind_uq").on(
      table.calculationSnapshotId,
      table.kind,
    ),
    index("calculation_lines_snapshot_idx").on(table.calculationSnapshotId),
  ],
);

export const calculationsRelations = relations(calculations, ({ many, one }) => ({
  currentSnapshot: one(calculationSnapshots, {
    relationName: "calculations_current_snapshot",
    fields: [calculations.currentSnapshotId],
    references: [calculationSnapshots.id],
  }),
  snapshots: many(calculationSnapshots, {
    relationName: "calculation_snapshots_calculation",
  }),
}));

export const calculationSnapshotsRelations = relations(
  calculationSnapshots,
  ({ many, one }) => ({
    calculation: one(calculations, {
      relationName: "calculation_snapshots_calculation",
      fields: [calculationSnapshots.calculationId],
      references: [calculations.id],
    }),
    lines: many(calculationLines),
    currentCalculation: one(calculations, {
      relationName: "calculations_current_snapshot",
      fields: [calculationSnapshots.id],
      references: [calculations.currentSnapshotId],
    }),
  }),
);

export const calculationLinesRelations = relations(
  calculationLines,
  ({ one }) => ({
    snapshot: one(calculationSnapshots, {
      fields: [calculationLines.calculationSnapshotId],
      references: [calculationSnapshots.id],
    }),
    currency: one(currencies, {
      fields: [calculationLines.currencyId],
      references: [currencies.id],
    }),
  }),
);
