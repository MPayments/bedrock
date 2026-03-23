import { z } from "zod";

import { isValidCurrency, normalizeCurrency } from "@bedrock/currencies/contracts";

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
const positiveIntegerSchema = z
  .number()
  .int()
  .positive({ message: "Value must be positive" });

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

export {
  componentKindSchema,
  currencySchema,
  nonNegativeAmountSchema,
  nonNegativeIntegerSchema,
  positiveAmountSchema,
  positiveIntegerSchema,
  uuidSchema,
};
