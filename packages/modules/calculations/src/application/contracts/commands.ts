import { z } from "zod";

import { CalculationRateSourceSchema } from "./zod";

const NonNegativeIntegerStringSchema = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d*)$/, "Must be a non-negative integer string");

export const CreateCalculationInputSchema = z
  .object({
    calculationCurrencyId: z.uuid(),
    originalAmountMinor: NonNegativeIntegerStringSchema,
    feeBps: NonNegativeIntegerStringSchema,
    feeAmountMinor: NonNegativeIntegerStringSchema,
    totalAmountMinor: NonNegativeIntegerStringSchema,
    baseCurrencyId: z.uuid(),
    feeAmountInBaseMinor: NonNegativeIntegerStringSchema,
    totalInBaseMinor: NonNegativeIntegerStringSchema,
    additionalExpensesCurrencyId: z.uuid().nullable().optional(),
    additionalExpensesAmountMinor: NonNegativeIntegerStringSchema,
    additionalExpensesInBaseMinor: NonNegativeIntegerStringSchema,
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
  });

export type CreateCalculationInput = z.infer<
  typeof CreateCalculationInputSchema
>;

export type NormalizedCreateCalculationInput = Omit<
  z.infer<typeof CreateCalculationInputSchema>,
  | "originalAmountMinor"
  | "feeBps"
  | "feeAmountMinor"
  | "totalAmountMinor"
  | "feeAmountInBaseMinor"
  | "totalInBaseMinor"
  | "additionalExpensesAmountMinor"
  | "additionalExpensesInBaseMinor"
  | "totalWithExpensesInBaseMinor"
  | "rateNum"
  | "rateDen"
  | "additionalExpensesCurrencyId"
  | "additionalExpensesRateSource"
  | "additionalExpensesRateNum"
  | "additionalExpensesRateDen"
  | "fxQuoteId"
> & {
  additionalExpensesCurrencyId: string | null;
  additionalExpensesRateSource:
    | z.infer<typeof CalculationRateSourceSchema>
    | null;
  additionalExpensesRateNum: bigint | null;
  additionalExpensesRateDen: bigint | null;
  feeAmountInBaseMinor: bigint;
  feeAmountMinor: bigint;
  feeBps: bigint;
  fxQuoteId: string | null;
  originalAmountMinor: bigint;
  rateDen: bigint;
  rateNum: bigint;
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

  return {
    ...validated,
    originalAmountMinor: BigInt(validated.originalAmountMinor),
    feeBps: BigInt(validated.feeBps),
    feeAmountMinor: BigInt(validated.feeAmountMinor),
    totalAmountMinor: BigInt(validated.totalAmountMinor),
    feeAmountInBaseMinor: BigInt(validated.feeAmountInBaseMinor),
    totalInBaseMinor: BigInt(validated.totalInBaseMinor),
    additionalExpensesCurrencyId: validated.additionalExpensesCurrencyId ?? null,
    additionalExpensesAmountMinor: BigInt(
      validated.additionalExpensesAmountMinor,
    ),
    additionalExpensesInBaseMinor: BigInt(
      validated.additionalExpensesInBaseMinor,
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
  };
}
