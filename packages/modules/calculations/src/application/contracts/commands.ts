import { z } from "zod";

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
  .trim()
  .regex(/^(0|[1-9]\d*)$/, "Must be a non-negative integer string");
const SignedIntegerStringSchema = z
  .string()
  .trim()
  .regex(/^-?(0|[1-9]\d*)$/, "Must be an integer string");
const NullableShortTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .nullable()
  .optional();
const NullableSnapshotSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional();

const FinancialLineInputSchema = z.object({
  basisAmountMinor: SignedIntegerStringSchema.nullable().optional(),
  basisType: CalculationComponentBasisTypeSchema.nullable().optional(),
  classification: CalculationComponentClassificationSchema.nullable().optional(),
  componentCode: NullableShortTextSchema,
  componentFamily: NullableShortTextSchema,
  kind: CalculationLineKindSchema,
  currencyId: z.uuid(),
  amountMinor: SignedIntegerStringSchema,
  dealId: z.uuid().nullable().optional(),
  formulaType: CalculationComponentFormulaTypeSchema.nullable().optional(),
  inputBps: z.string().trim().min(1).max(64).nullable().optional(),
  inputFixedAmountMinor: SignedIntegerStringSchema.nullable().optional(),
  inputManualAmountMinor: SignedIntegerStringSchema.nullable().optional(),
  inputPerMillion: z.string().trim().min(1).max(64).nullable().optional(),
  routeComponentId: z.uuid().nullable().optional(),
  routeLegId: z.uuid().nullable().optional(),
  routeVersionId: z.uuid().nullable().optional(),
  sourceKind: CalculationLineSourceKindSchema.optional(),
});

export const CreateCalculationInputSchema = z
  .object({
    agreementVersionId: z.uuid().nullable().optional(),
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
    dealId: z.uuid().nullable().optional(),
    dealSnapshot: NullableSnapshotSchema,
    additionalExpensesCurrencyId: z.uuid().nullable().optional(),
    additionalExpensesAmountMinor: NonNegativeIntegerStringSchema,
    additionalExpensesInBaseMinor: NonNegativeIntegerStringSchema,
    fixedFeeAmountMinor: NonNegativeIntegerStringSchema,
    fixedFeeCurrencyId: z.uuid().nullable().optional(),
    pricingProvenance: NullableSnapshotSchema,
    quoteMarkupAmountMinor: NonNegativeIntegerStringSchema,
    quoteMarkupBps: NonNegativeIntegerStringSchema,
    routeVersionId: z.uuid().nullable().optional(),
    routeSnapshot: NullableSnapshotSchema,
  referenceRateAsOf: z.coerce.date().nullable().optional(),
  referenceRateSource: CalculationRateSourceSchema.nullable().optional(),
  referenceRateNum: NonNegativeIntegerStringSchema.nullable().optional(),
  referenceRateDen: NonNegativeIntegerStringSchema.nullable().optional(),
  grossRevenueInBaseMinor: SignedIntegerStringSchema.optional(),
  expenseAmountInBaseMinor: SignedIntegerStringSchema.optional(),
  passThroughAmountInBaseMinor: SignedIntegerStringSchema.optional(),
  netMarginInBaseMinor: SignedIntegerStringSchema.optional(),
  state: CalculationStateSchema.optional(),
    totalWithExpensesInBaseMinor: NonNegativeIntegerStringSchema,
    rateSource: CalculationRateSourceSchema,
    rateNum: NonNegativeIntegerStringSchema,
    rateDen: NonNegativeIntegerStringSchema,
    additionalExpensesRateSource: CalculationRateSourceSchema
      .nullable()
      .optional(),
    additionalExpensesRateNum: NonNegativeIntegerStringSchema
      .nullable()
      .optional(),
    additionalExpensesRateDen: NonNegativeIntegerStringSchema
      .nullable()
      .optional(),
    calculationTimestamp: z.coerce.date(),
    fxQuoteId: z.uuid().nullable().optional(),
    financialLines: z.array(FinancialLineInputSchema).optional(),
    quoteSnapshot: NullableSnapshotSchema,
  })
  .superRefine((value, ctx) => {
    if (value.rateNum === "0") {
      ctx.addIssue({
        code: "custom",
        path: ["rateNum"],
        message: "rateNum must be positive",
      });
    }

    if (value.rateDen === "0") {
      ctx.addIssue({
        code: "custom",
        path: ["rateDen"],
        message: "rateDen must be positive",
      });
    }

    const fxQuoteId = value.fxQuoteId ?? null;
    if (value.rateSource === "fx_quote" && !fxQuoteId) {
      ctx.addIssue({
        code: "custom",
        path: ["fxQuoteId"],
        message: "fxQuoteId is required when rateSource is fx_quote",
      });
    }

    if (value.rateSource !== "fx_quote" && fxQuoteId) {
      ctx.addIssue({
        code: "custom",
        path: ["fxQuoteId"],
        message: "fxQuoteId is allowed only when rateSource is fx_quote",
      });
    }

    const addSource = value.additionalExpensesRateSource ?? null;
    const addNum = value.additionalExpensesRateNum ?? null;
    const addDen = value.additionalExpensesRateDen ?? null;
    const addCurrencyId = value.additionalExpensesCurrencyId ?? null;

    if (addSource === null) {
      if (addNum !== null || addDen !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["additionalExpensesRateSource"],
          message:
            "additionalExpensesRateSource is required when additional expenses rate fields are provided",
        });
      }
    } else {
      if (addNum === null || addDen === null) {
        ctx.addIssue({
          code: "custom",
          path: ["additionalExpensesRateNum"],
          message:
            "additionalExpensesRateNum and additionalExpensesRateDen are required when additionalExpensesRateSource is provided",
        });
      }

      if (addNum === "0") {
        ctx.addIssue({
          code: "custom",
          path: ["additionalExpensesRateNum"],
          message: "additionalExpensesRateNum must be positive",
        });
      }

      if (addDen === "0") {
        ctx.addIssue({
          code: "custom",
          path: ["additionalExpensesRateDen"],
          message: "additionalExpensesRateDen must be positive",
        });
      }
    }

    if (addCurrencyId === null || addCurrencyId === value.baseCurrencyId) {
      if (addSource !== null || addNum !== null || addDen !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["additionalExpensesRateSource"],
          message:
            "additional expenses rate fields must be null when additional expenses are base-denominated",
        });
      }
    } else if (addSource === null || addNum === null || addDen === null) {
      ctx.addIssue({
        code: "custom",
        path: ["additionalExpensesRateSource"],
        message:
          "additional expenses rate fields are required when additionalExpensesCurrencyId differs from baseCurrencyId",
      });
    }

    if (addSource === "fx_quote" && !fxQuoteId) {
      ctx.addIssue({
        code: "custom",
        path: ["fxQuoteId"],
        message:
          "fxQuoteId is required when additionalExpensesRateSource is fx_quote",
      });
    }

    const fixedFeeCurrencyId = value.fixedFeeCurrencyId ?? null;
    if (value.fixedFeeAmountMinor === "0" && fixedFeeCurrencyId !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["fixedFeeCurrencyId"],
        message:
          "fixedFeeCurrencyId must be null when fixedFeeAmountMinor is zero",
      });
    }

    if (value.fixedFeeAmountMinor !== "0" && fixedFeeCurrencyId === null) {
      ctx.addIssue({
        code: "custom",
        path: ["fixedFeeCurrencyId"],
        message:
          "fixedFeeCurrencyId is required when fixedFeeAmountMinor is non-zero",
      });
    }

    const referenceRateSource = value.referenceRateSource ?? null;
    const referenceRateNum = value.referenceRateNum ?? null;
    const referenceRateDen = value.referenceRateDen ?? null;
    const referenceRateAsOf = value.referenceRateAsOf ?? null;

    if (referenceRateSource === null) {
      if (
        referenceRateNum !== null ||
        referenceRateDen !== null ||
        referenceRateAsOf !== null
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["referenceRateSource"],
          message:
            "referenceRateSource is required when reference rate fields are provided",
        });
      }
    } else {
      if (
        referenceRateNum === null ||
        referenceRateDen === null ||
        referenceRateAsOf === null
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["referenceRateNum"],
          message:
            "referenceRateNum, referenceRateDen, and referenceRateAsOf are required when referenceRateSource is provided",
        });
      }

      if (referenceRateNum === "0") {
        ctx.addIssue({
          code: "custom",
          path: ["referenceRateNum"],
          message: "referenceRateNum must be positive",
        });
      }

      if (referenceRateDen === "0") {
        ctx.addIssue({
          code: "custom",
          path: ["referenceRateDen"],
          message: "referenceRateDen must be positive",
        });
      }
    }
  });

export type CreateCalculationInput = z.infer<
  typeof CreateCalculationInputSchema
>;

export const UpdateCalculationStateInputSchema = z.object({
  calculationId: z.uuid(),
  state: CalculationStateSchema,
});

export type UpdateCalculationStateInput = z.infer<
  typeof UpdateCalculationStateInputSchema
>;

type NormalizedFinancialLineInput = {
  amountMinor: bigint;
  basisAmountMinor: bigint | null;
  basisType: z.infer<typeof CalculationComponentBasisTypeSchema> | null;
  classification:
    | z.infer<typeof CalculationComponentClassificationSchema>
    | null;
  componentCode: string | null;
  componentFamily: string | null;
  currencyId: string;
  dealId: string | null;
  formulaType: z.infer<typeof CalculationComponentFormulaTypeSchema> | null;
  inputBps: string | null;
  inputFixedAmountMinor: bigint | null;
  inputManualAmountMinor: bigint | null;
  inputPerMillion: string | null;
  kind: z.infer<typeof CalculationLineKindSchema>;
  routeComponentId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceKind: z.infer<typeof CalculationLineSourceKindSchema>;
};

export type NormalizedCreateCalculationInput = Omit<
  z.infer<typeof CreateCalculationInputSchema>,
  | "originalAmountMinor"
  | "agreementFeeBps"
  | "agreementFeeAmountMinor"
  | "totalFeeBps"
  | "totalFeeAmountMinor"
  | "totalAmountMinor"
  | "totalFeeAmountInBaseMinor"
  | "totalInBaseMinor"
  | "additionalExpensesAmountMinor"
  | "additionalExpensesInBaseMinor"
  | "fixedFeeAmountMinor"
  | "quoteMarkupAmountMinor"
  | "quoteMarkupBps"
  | "referenceRateDen"
  | "referenceRateNum"
  | "totalWithExpensesInBaseMinor"
  | "rateNum"
  | "rateDen"
  | "additionalExpensesCurrencyId"
  | "additionalExpensesRateSource"
  | "additionalExpensesRateNum"
  | "additionalExpensesRateDen"
  | "fixedFeeCurrencyId"
  | "fxQuoteId"
  | "financialLines"
  | "grossRevenueInBaseMinor"
  | "expenseAmountInBaseMinor"
  | "passThroughAmountInBaseMinor"
  | "netMarginInBaseMinor"
> & {
  additionalExpensesCurrencyId: string | null;
  additionalExpensesRateSource:
    | z.infer<typeof CalculationRateSourceSchema>
    | null;
  additionalExpensesRateNum: bigint | null;
  additionalExpensesRateDen: bigint | null;
  agreementFeeAmountMinor: bigint;
  agreementFeeBps: bigint;
  dealId: string | null;
  dealSnapshot: Record<string, unknown> | null;
  fixedFeeAmountMinor: bigint;
  fixedFeeCurrencyId: string | null;
  fxQuoteId: string | null;
  grossRevenueInBaseMinor: bigint | null;
  financialLines: NormalizedFinancialLineInput[];
  expenseAmountInBaseMinor: bigint | null;
  netMarginInBaseMinor: bigint | null;
  originalAmountMinor: bigint;
  passThroughAmountInBaseMinor: bigint | null;
  pricingProvenance: Record<string, unknown> | null;
  rateDen: bigint;
  rateNum: bigint;
  referenceRateAsOf: Date | null;
  referenceRateSource: z.infer<typeof CalculationRateSourceSchema> | null;
  referenceRateNum: bigint | null;
  referenceRateDen: bigint | null;
  quoteMarkupAmountMinor: bigint;
  quoteMarkupBps: bigint;
  routeSnapshot: Record<string, unknown> | null;
  routeVersionId: string | null;
  state: z.infer<typeof CalculationStateSchema>;
  totalFeeAmountInBaseMinor: bigint;
  totalFeeAmountMinor: bigint;
  totalFeeBps: bigint;
  totalAmountMinor: bigint;
  totalInBaseMinor: bigint;
  additionalExpensesAmountMinor: bigint;
  additionalExpensesInBaseMinor: bigint;
  totalWithExpensesInBaseMinor: bigint;
};

function normalizeNullableBigInt(
  value: string | null | undefined,
): bigint | null {
  return value === undefined || value === null ? null : BigInt(value);
}

export function normalizeCreateCalculationInput(
  input: CreateCalculationInput,
): NormalizedCreateCalculationInput {
  const validated = CreateCalculationInputSchema.parse(input);
  const normalizedLines =
    validated.financialLines?.map((line) => ({
      basisAmountMinor: normalizeNullableBigInt(line.basisAmountMinor),
      basisType: line.basisType ?? null,
      classification: line.classification ?? null,
      componentCode: line.componentCode ?? null,
      componentFamily: line.componentFamily ?? null,
      kind: line.kind,
      currencyId: line.currencyId,
      dealId: line.dealId ?? null,
      formulaType: line.formulaType ?? null,
      inputBps: line.inputBps ?? null,
      inputFixedAmountMinor: normalizeNullableBigInt(line.inputFixedAmountMinor),
      inputManualAmountMinor: normalizeNullableBigInt(
        line.inputManualAmountMinor,
      ),
      inputPerMillion: line.inputPerMillion ?? null,
      amountMinor: BigInt(line.amountMinor),
      routeComponentId: line.routeComponentId ?? null,
      routeLegId: line.routeLegId ?? null,
      routeVersionId: line.routeVersionId ?? null,
      sourceKind: line.sourceKind ?? "manual",
    })) ?? [];

  return {
    ...validated,
    agreementVersionId: validated.agreementVersionId ?? null,
    agreementFeeBps: BigInt(validated.agreementFeeBps),
    agreementFeeAmountMinor: BigInt(validated.agreementFeeAmountMinor),
    originalAmountMinor: BigInt(validated.originalAmountMinor),
    totalFeeBps: BigInt(validated.totalFeeBps),
    totalFeeAmountMinor: BigInt(validated.totalFeeAmountMinor),
    totalAmountMinor: BigInt(validated.totalAmountMinor),
    totalFeeAmountInBaseMinor: BigInt(validated.totalFeeAmountInBaseMinor),
    totalInBaseMinor: BigInt(validated.totalInBaseMinor),
    dealId: validated.dealId ?? null,
    dealSnapshot: validated.dealSnapshot ?? null,
    additionalExpensesCurrencyId: validated.additionalExpensesCurrencyId ?? null,
    additionalExpensesAmountMinor: BigInt(
      validated.additionalExpensesAmountMinor,
    ),
    additionalExpensesInBaseMinor: BigInt(
      validated.additionalExpensesInBaseMinor,
    ),
    fixedFeeAmountMinor: BigInt(validated.fixedFeeAmountMinor),
    fixedFeeCurrencyId: validated.fixedFeeCurrencyId ?? null,
    pricingProvenance: validated.pricingProvenance ?? null,
    quoteMarkupAmountMinor: BigInt(validated.quoteMarkupAmountMinor),
    quoteMarkupBps: BigInt(validated.quoteMarkupBps),
    routeVersionId: validated.routeVersionId ?? null,
    routeSnapshot: validated.routeSnapshot ?? null,
    referenceRateAsOf: validated.referenceRateAsOf ?? null,
    referenceRateSource: validated.referenceRateSource ?? null,
    referenceRateNum:
      validated.referenceRateNum !== undefined &&
      validated.referenceRateNum !== null
        ? BigInt(validated.referenceRateNum)
        : null,
    referenceRateDen:
      validated.referenceRateDen !== undefined &&
      validated.referenceRateDen !== null
        ? BigInt(validated.referenceRateDen)
        : null,
    grossRevenueInBaseMinor: normalizeNullableBigInt(
      validated.grossRevenueInBaseMinor,
    ),
    expenseAmountInBaseMinor: normalizeNullableBigInt(
      validated.expenseAmountInBaseMinor,
    ),
    passThroughAmountInBaseMinor: normalizeNullableBigInt(
      validated.passThroughAmountInBaseMinor,
    ),
    netMarginInBaseMinor: normalizeNullableBigInt(
      validated.netMarginInBaseMinor,
    ),
    totalWithExpensesInBaseMinor: BigInt(
      validated.totalWithExpensesInBaseMinor,
    ),
    rateNum: BigInt(validated.rateNum),
    rateDen: BigInt(validated.rateDen),
    additionalExpensesRateSource:
      validated.additionalExpensesRateSource ?? null,
    additionalExpensesRateNum:
      validated.additionalExpensesRateNum !== undefined &&
      validated.additionalExpensesRateNum !== null
        ? BigInt(validated.additionalExpensesRateNum)
        : null,
    additionalExpensesRateDen:
      validated.additionalExpensesRateDen !== undefined &&
      validated.additionalExpensesRateDen !== null
        ? BigInt(validated.additionalExpensesRateDen)
        : null,
    fxQuoteId: validated.fxQuoteId ?? null,
    financialLines: normalizedLines,
    state: validated.state ?? "draft",
  };
}
