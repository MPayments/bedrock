import { z } from "zod";

import { isValidCurrency, normalizeCurrency } from "@bedrock/app/currencies/catalog";

import { FeeValidationError } from "./errors";

const uuidSchema = z.uuid();
const currencySchema = z
  .string()
  .refine((value) => isValidCurrency(value), {
    message:
      "Currency must be 2-16 uppercase alphanumeric characters or underscores",
  })
  .transform((value) => normalizeCurrency(value));

const componentIdSchema = z
  .string()
  .min(1, "fee component id is required")
  .max(128);
const componentKindSchema = z
  .string()
  .min(1, "fee component kind is required")
  .max(64);
const nonNegativeAmountSchema = z
  .bigint()
  .min(0n, { message: "Amount must be non-negative" });
const positiveAmountSchema = z
  .bigint()
  .positive({ message: "Amount must be positive" });
const nonNegativeIntegerSchema = z
  .number()
  .int()
  .min(0, { message: "Value must be non-negative" });

export const feeDealDirectionSchema = z.enum([
  "cash_to_wire",
  "wire_to_cash",
  "wire_to_wire",
  "usdt_to_cash",
  "cash_to_usdt",
  "other",
]);

export const feeDealFormSchema = z.enum(["conversion", "transit"]);

export const feeOperationKindSchema = z.enum([
  "fx_quote",
  "fx_execution",
  "funding",
  "payout",
  "internal_transfer",
  "external_transfer",
  "custom",
]);

export const feeCalcMethodSchema = z.enum(["bps", "fixed"]);

export const feeSourceSchema = z.enum(["rule", "manual"]);

export const feeSettlementModeSchema = z.enum([
  "in_ledger",
  "separate_payment_order",
]);
export const feeAccountingTreatmentSchema = z.enum([
  "income",
  "pass_through",
  "expense",
]);

export const adjustmentEffectSchema = z.enum([
  "increase_charge",
  "decrease_charge",
]);
export const adjustmentSourceSchema = z.enum(["manual", "rule"]);

export const feeComponentSchema = z.object({
  id: componentIdSchema,
  ruleId: uuidSchema.optional(),
  kind: componentKindSchema,
  currency: currencySchema,
  amountMinor: nonNegativeAmountSchema,
  source: feeSourceSchema,
  settlementMode: feeSettlementModeSchema.optional(),
  accountingTreatment: feeAccountingTreatmentSchema.optional(),
  memo: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.string().max(255)).optional(),
});

export const adjustmentComponentSchema = z.object({
  id: componentIdSchema,
  kind: componentKindSchema,
  effect: adjustmentEffectSchema,
  currency: currencySchema,
  amountMinor: positiveAmountSchema,
  source: adjustmentSourceSchema,
  settlementMode: feeSettlementModeSchema.optional(),
  accountingTreatment: feeAccountingTreatmentSchema.optional(),
  memo: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.string().max(255)).optional(),
});

export const upsertFeeRuleSchema = z
  .object({
    name: z.string().min(1).max(255),
    operationKind: feeOperationKindSchema,
    feeKind: componentKindSchema,
    calcMethod: feeCalcMethodSchema,

    bps: nonNegativeIntegerSchema
      .max(10000, "bps cannot exceed 10000 (100%)")
      .optional(),
    fixedAmountMinor: nonNegativeAmountSchema.optional(),
    fixedCurrency: currencySchema.optional(),

    settlementMode: feeSettlementModeSchema.optional(),
    accountingTreatment: feeAccountingTreatmentSchema.optional(),

    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    fromCurrency: currencySchema.optional(),
    toCurrency: currencySchema.optional(),

    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),

    effectiveFrom: z.date().optional(),
    effectiveTo: z.date().optional(),
    memo: z.string().max(1000).optional(),
    metadata: z.record(z.string(), z.string().max(255)).optional(),
  })
  .refine(
    (data) => {
      if (data.calcMethod === "bps") {
        return data.bps !== undefined && data.fixedAmountMinor === undefined;
      }

      return data.fixedAmountMinor !== undefined && data.bps === undefined;
    },
    {
      message:
        "calcMethod=bps requires bps and forbids fixedAmountMinor; calcMethod=fixed requires fixedAmountMinor",
      path: ["calcMethod"],
    },
  )
  .refine(
    (data) => {
      if (!data.effectiveTo || !data.effectiveFrom) return true;
      return data.effectiveTo.getTime() > data.effectiveFrom.getTime();
    },
    {
      message: "effectiveTo must be later than effectiveFrom",
      path: ["effectiveTo"],
    },
  );

export const resolveFeeRulesInputSchema = z.object({
  operationKind: feeOperationKindSchema,
  at: z.date(),
  fromCurrency: currencySchema.optional(),
  toCurrency: currencySchema.optional(),
  dealDirection: feeDealDirectionSchema.optional(),
  dealForm: feeDealFormSchema.optional(),
});

export const fxQuoteFeeCalculationSchema = z.object({
  fromCurrency: currencySchema,
  toCurrency: currencySchema,
  principalMinor: positiveAmountSchema,
  at: z.date(),
  dealDirection: feeDealDirectionSchema.optional(),
  dealForm: feeDealFormSchema.optional(),
});

export const saveQuoteFeeComponentsSchema = z.object({
  quoteId: uuidSchema,
  components: z.array(feeComponentSchema),
});

export const getQuoteFeeComponentsSchema = z.object({
  quoteId: uuidSchema,
});

export function validateFeeComponent(input: unknown) {
  return validateInput(feeComponentSchema, input, "feeComponent");
}

export function validateAdjustmentComponent(input: unknown) {
  return validateInput(adjustmentComponentSchema, input, "adjustmentComponent");
}

export function validateUpsertFeeRuleInput(input: unknown) {
  return validateInput(upsertFeeRuleSchema, input, "upsertFeeRule");
}

export function validateResolveFeeRulesInput(input: unknown) {
  return validateInput(resolveFeeRulesInputSchema, input, "resolveFeeRules");
}

export function validateFxQuoteFeeCalculation(input: unknown) {
  return validateInput(
    fxQuoteFeeCalculationSchema,
    input,
    "calculateFxQuoteFeeComponents",
  );
}

export function validateSaveQuoteFeeComponentsInput(input: unknown) {
  return validateInput(
    saveQuoteFeeComponentsSchema,
    input,
    "saveQuoteFeeComponents",
  );
}

export function validateGetQuoteFeeComponentsInput(input: unknown) {
  return validateInput(
    getQuoteFeeComponentsSchema,
    input,
    "getQuoteFeeComponents",
  );
}

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const errors = result.error.issues;
    if (!errors || errors.length === 0) {
      throw new FeeValidationError(
        `Validation failed${context ? ` for ${context}` : ""}: ${result.error.message || "Unknown error"}`,
      );
    }

    const firstError = errors[0]!;
    const path = firstError.path.join(".");
    const message = path
      ? `${path}: ${firstError.message}`
      : firstError.message;

    throw new FeeValidationError(`${context ? `${context}: ` : ""}${message}`);
  }

  return result.data;
}
