import { z } from "zod";

import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  CalculationLineKindSchema,
  CalculationRateSourceSchema,
} from "./zod";

const NonNegativeIntegerStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/);
const SignedIntegerStringSchema = z
  .string()
  .regex(/^-?(0|[1-9]\d*)$/);

export const CalculationLineSchema = z.object({
  id: z.uuid(),
  idx: z.number().int().nonnegative(),
  kind: CalculationLineKindSchema,
  currencyId: z.uuid(),
  amountMinor: SignedIntegerStringSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CalculationLine = z.infer<typeof CalculationLineSchema>;

export const CalculationSnapshotSchema = z.object({
  id: z.uuid(),
  snapshotNumber: z.number().int().positive(),
  agreementVersionId: z.uuid().nullable(),
  agreementFeeBps: NonNegativeIntegerStringSchema,
  agreementFeeAmountMinor: NonNegativeIntegerStringSchema,
  calculationCurrencyId: z.uuid(),
  originalAmountMinor: NonNegativeIntegerStringSchema,
  totalFeeBps: NonNegativeIntegerStringSchema,
  totalFeeAmountMinor: NonNegativeIntegerStringSchema,
  totalAmountMinor: NonNegativeIntegerStringSchema,
  baseCurrencyId: z.uuid(),
  totalFeeAmountInBaseMinor: NonNegativeIntegerStringSchema,
  totalInBaseMinor: NonNegativeIntegerStringSchema,
  additionalExpensesCurrencyId: z.uuid().nullable(),
  additionalExpensesAmountMinor: NonNegativeIntegerStringSchema,
  additionalExpensesInBaseMinor: NonNegativeIntegerStringSchema,
  fixedFeeAmountMinor: NonNegativeIntegerStringSchema,
  fixedFeeCurrencyId: z.uuid().nullable(),
  quoteMarkupBps: NonNegativeIntegerStringSchema,
  quoteMarkupAmountMinor: NonNegativeIntegerStringSchema,
  referenceRateSource: CalculationRateSourceSchema.nullable(),
  referenceRateNum: NonNegativeIntegerStringSchema.nullable(),
  referenceRateDen: NonNegativeIntegerStringSchema.nullable(),
  referenceRateAsOf: z.date().nullable(),
  pricingProvenance: z.record(z.string(), z.unknown()).nullable(),
  totalWithExpensesInBaseMinor: NonNegativeIntegerStringSchema,
  rateSource: CalculationRateSourceSchema,
  rateNum: NonNegativeIntegerStringSchema,
  rateDen: NonNegativeIntegerStringSchema,
  additionalExpensesRateSource: CalculationRateSourceSchema.nullable(),
  additionalExpensesRateNum: NonNegativeIntegerStringSchema.nullable(),
  additionalExpensesRateDen: NonNegativeIntegerStringSchema.nullable(),
  calculationTimestamp: z.date(),
  fxQuoteId: z.uuid().nullable(),
  quoteSnapshot: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CalculationSnapshot = z.infer<typeof CalculationSnapshotSchema>;

export const CalculationSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
  currentSnapshot: CalculationSnapshotSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Calculation = z.infer<typeof CalculationSchema>;

export const CalculationDetailsSchema = CalculationSchema.extend({
  lines: z.array(CalculationLineSchema),
});

export type CalculationDetails = z.infer<typeof CalculationDetailsSchema>;

export const PaginatedCalculationsSchema =
  createPaginatedListSchema(CalculationSchema);

export type PaginatedCalculations = PaginatedList<Calculation>;
