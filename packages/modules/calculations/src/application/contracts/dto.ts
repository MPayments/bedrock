import { z } from "zod";

import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  CalculationComponentBasisTypeSchema,
  CalculationComponentClassificationSchema,
  CalculationComponentFormulaTypeSchema,
  CalculationLineKindSchema,
  CalculationLineSourceKindSchema,
  CalculationRateSourceSchema,
  CalculationStateSchema,
} from "./zod";

const NonNegativeIntegerStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/);
const SignedIntegerStringSchema = z
  .string()
  .regex(/^-?(0|[1-9]\d*)$/);

export const CalculationLineSchema = z.object({
  basisAmountMinor: SignedIntegerStringSchema.nullable(),
  basisType: CalculationComponentBasisTypeSchema.nullable(),
  classification: CalculationComponentClassificationSchema.nullable(),
  componentCode: z.string().nullable(),
  componentFamily: z.string().nullable(),
  id: z.uuid(),
  idx: z.number().int().nonnegative(),
  kind: CalculationLineKindSchema,
  currencyId: z.uuid(),
  dealId: z.uuid().nullable(),
  formulaType: CalculationComponentFormulaTypeSchema.nullable(),
  inputBps: z.string().nullable(),
  inputFixedAmountMinor: SignedIntegerStringSchema.nullable(),
  inputManualAmountMinor: SignedIntegerStringSchema.nullable(),
  inputPerMillion: z.string().nullable(),
  amountMinor: SignedIntegerStringSchema,
  routeComponentId: z.uuid().nullable(),
  routeLegId: z.uuid().nullable(),
  routeVersionId: z.uuid().nullable(),
  sourceKind: CalculationLineSourceKindSchema,
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
  dealId: z.uuid().nullable(),
  dealSnapshot: z.record(z.string(), z.unknown()).nullable(),
  additionalExpensesCurrencyId: z.uuid().nullable(),
  additionalExpensesAmountMinor: NonNegativeIntegerStringSchema,
  additionalExpensesInBaseMinor: NonNegativeIntegerStringSchema,
  fixedFeeAmountMinor: NonNegativeIntegerStringSchema,
  fixedFeeCurrencyId: z.uuid().nullable(),
  quoteMarkupBps: NonNegativeIntegerStringSchema,
  quoteMarkupAmountMinor: NonNegativeIntegerStringSchema,
  routeVersionId: z.uuid().nullable(),
  routeSnapshot: z.record(z.string(), z.unknown()).nullable(),
  referenceRateSource: CalculationRateSourceSchema.nullable(),
  referenceRateNum: NonNegativeIntegerStringSchema.nullable(),
  referenceRateDen: NonNegativeIntegerStringSchema.nullable(),
  referenceRateAsOf: z.date().nullable(),
  pricingProvenance: z.record(z.string(), z.unknown()).nullable(),
  grossRevenueInBaseMinor: SignedIntegerStringSchema,
  expenseAmountInBaseMinor: SignedIntegerStringSchema,
  passThroughAmountInBaseMinor: SignedIntegerStringSchema,
  netMarginInBaseMinor: SignedIntegerStringSchema,
  state: CalculationStateSchema,
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

const CalculationAmountDeltaSchema = z.object({
  deltaMinor: SignedIntegerStringSchema,
  leftMinor: SignedIntegerStringSchema,
  rightMinor: SignedIntegerStringSchema,
});

export const CalculationCompareLineSchema = z.object({
  basisAmountMinor: SignedIntegerStringSchema.nullable(),
  classification: CalculationComponentClassificationSchema.nullable(),
  componentCode: z.string(),
  componentFamily: z.string().nullable(),
  currencyId: z.uuid(),
  deltaAmountMinor: SignedIntegerStringSchema,
  kind: CalculationLineKindSchema,
  leftAmountMinor: SignedIntegerStringSchema,
  rightAmountMinor: SignedIntegerStringSchema,
  routeComponentId: z.uuid().nullable(),
  routeLegId: z.uuid().nullable(),
});

export type CalculationCompareLine = z.infer<typeof CalculationCompareLineSchema>;

export const CalculationCompareSchema = z.object({
  left: CalculationDetailsSchema,
  right: CalculationDetailsSchema,
  lineDiffs: z.array(CalculationCompareLineSchema),
  totals: z.object({
    expenseAmountInBaseMinor: CalculationAmountDeltaSchema,
    grossRevenueInBaseMinor: CalculationAmountDeltaSchema,
    netMarginInBaseMinor: CalculationAmountDeltaSchema,
    passThroughAmountInBaseMinor: CalculationAmountDeltaSchema,
    totalInBaseMinor: CalculationAmountDeltaSchema,
    totalWithExpensesInBaseMinor: CalculationAmountDeltaSchema,
  }),
});

export type CalculationCompare = z.infer<typeof CalculationCompareSchema>;

export const PaginatedCalculationsSchema =
  createPaginatedListSchema(CalculationSchema);

export type PaginatedCalculations = PaginatedList<Calculation>;
