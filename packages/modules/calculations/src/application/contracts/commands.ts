import { z } from "zod";

import {
  CalculationLineKindSchema,
  CalculationRateSourceSchema,
} from "./zod";

const NonNegativeIntegerStringSchema = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d*)$/, "Must be a non-negative integer string");
const SignedIntegerStringSchema = z
  .string()
  .trim()
  .regex(/^-?(0|[1-9]\d*)$/, "Must be an integer string");

const FinancialLineInputSchema = z.object({
  kind: CalculationLineKindSchema,
  currencyId: z.uuid(),
  amountMinor: SignedIntegerStringSchema,
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
    additionalExpensesCurrencyId: z.uuid().nullable().optional(),
    additionalExpensesAmountMinor: NonNegativeIntegerStringSchema,
    additionalExpensesInBaseMinor: NonNegativeIntegerStringSchema,
    fixedFeeAmountMinor: NonNegativeIntegerStringSchema,
    fixedFeeCurrencyId: z.uuid().nullable().optional(),
    pricingProvenance: z.record(z.string(), z.unknown()).nullable().optional(),
    quoteMarkupAmountMinor: NonNegativeIntegerStringSchema,
    quoteMarkupBps: NonNegativeIntegerStringSchema,
    referenceRateAsOf: z.coerce.date().nullable().optional(),
    referenceRateSource: CalculationRateSourceSchema.nullable().optional(),
    referenceRateNum: NonNegativeIntegerStringSchema.nullable().optional(),
    referenceRateDen: NonNegativeIntegerStringSchema.nullable().optional(),
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
    quoteSnapshot: z.record(z.string(), z.unknown()).optional(),
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
> & {
  additionalExpensesCurrencyId: string | null;
  additionalExpensesRateSource:
    | z.infer<typeof CalculationRateSourceSchema>
    | null;
  additionalExpensesRateNum: bigint | null;
  additionalExpensesRateDen: bigint | null;
  agreementFeeAmountMinor: bigint;
  agreementFeeBps: bigint;
  fixedFeeAmountMinor: bigint;
  fixedFeeCurrencyId: string | null;
  fxQuoteId: string | null;
  financialLines: {
    amountMinor: bigint;
    currencyId: string;
    kind: z.infer<typeof CalculationLineKindSchema>;
  }[];
  originalAmountMinor: bigint;
  pricingProvenance: Record<string, unknown> | null;
  rateDen: bigint;
  rateNum: bigint;
  referenceRateAsOf: Date | null;
  referenceRateSource: z.infer<typeof CalculationRateSourceSchema> | null;
  referenceRateNum: bigint | null;
  referenceRateDen: bigint | null;
  quoteMarkupAmountMinor: bigint;
  quoteMarkupBps: bigint;
  totalFeeAmountInBaseMinor: bigint;
  totalFeeAmountMinor: bigint;
  totalFeeBps: bigint;
  totalAmountMinor: bigint;
  totalInBaseMinor: bigint;
  additionalExpensesAmountMinor: bigint;
  additionalExpensesInBaseMinor: bigint;
  totalWithExpensesInBaseMinor: bigint;
};

export function normalizeCreateCalculationInput(
  input: CreateCalculationInput,
): NormalizedCreateCalculationInput {
  const validated = CreateCalculationInputSchema.parse(input);
  const normalizedLines =
    validated.financialLines?.map((line) => ({
      kind: line.kind,
      currencyId: line.currencyId,
      amountMinor: BigInt(line.amountMinor),
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
  };
}
