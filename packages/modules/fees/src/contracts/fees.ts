import { z } from "zod";

import { isValidCurrency, normalizeCurrency } from "@bedrock/currencies/catalog";

export type FeeDealDirection =
  | "cash_to_wire"
  | "wire_to_cash"
  | "wire_to_wire"
  | "usdt_to_cash"
  | "cash_to_usdt"
  | "other";

export type FeeDealForm = "conversion" | "transit";

export type FeeOperationKind =
  | "fx_quote"
  | "fx_execution"
  | "funding"
  | "payout"
  | "internal_transfer"
  | "external_transfer"
  | "custom";

export type FeeCalcMethod = "bps" | "fixed";

export type FeeComponentKind =
  | "fx_fee"
  | "fx_spread"
  | "bank_fee"
  | "blockchain_fee"
  | "manual_fee"
  | (string & {});

export type FeeSource = "rule" | "manual";

export type FeeSettlementMode = "in_ledger" | "separate_payment_order";
export type FeeAccountingTreatment = "income" | "pass_through" | "expense";

export type AdjustmentKind =
  | "late_penalty"
  | "discount"
  | "manual_adjustment"
  | (string & {});

export type AdjustmentEffect = "increase_charge" | "decrease_charge";

export type AdjustmentSource = "manual" | "rule";

export type AdjustmentSettlementMode = FeeSettlementMode;

export interface FeeComponent {
  id: string;
  ruleId?: string;
  kind: FeeComponentKind;
  currency: string;
  amountMinor: bigint;
  source: FeeSource;
  settlementMode?: FeeSettlementMode;
  accountingTreatment?: FeeAccountingTreatment;
  memo?: string;
  metadata?: Record<string, string>;
}

export interface AdjustmentComponent {
  id: string;
  kind: AdjustmentKind;
  effect: AdjustmentEffect;
  currency: string;
  amountMinor: bigint;
  source: AdjustmentSource;
  settlementMode?: AdjustmentSettlementMode;
  memo?: string;
  metadata?: Record<string, string>;
}

export interface CalculateFxQuoteFeeComponentsInput {
  fromCurrency: string;
  toCurrency: string;
  principalMinor: bigint;
  at: Date;
  dealDirection?: FeeDealDirection;
  dealForm?: FeeDealForm;
}

export interface UpsertFeeRuleInput {
  name: string;
  operationKind: FeeOperationKind;
  feeKind: FeeComponentKind;
  calcMethod: FeeCalcMethod;
  bps?: number;
  fixedAmountMinor?: bigint;
  fixedCurrency?: string;
  settlementMode?: FeeSettlementMode;
  accountingTreatment?: FeeAccountingTreatment;
  dealDirection?: FeeDealDirection;
  dealForm?: FeeDealForm;
  fromCurrency?: string;
  toCurrency?: string;
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  memo?: string;
  metadata?: Record<string, string>;
}

export interface ResolveFeeRulesInput {
  operationKind: FeeOperationKind;
  at: Date;
  fromCurrency?: string;
  toCurrency?: string;
  dealDirection?: FeeDealDirection;
  dealForm?: FeeDealForm;
}

export interface ApplicableFeeRule {
  id: string;
  calcMethod: FeeCalcMethod;
  bps: number | null;
  fixedAmountMinor: bigint | null;
  fixedCurrencyId: string | null;
  feeKind: FeeComponentKind;
  settlementMode: FeeSettlementMode;
  accountingTreatment: FeeAccountingTreatment;
  memo: string | null;
  metadata: Record<string, string> | null;
}

export interface MergeFeeComponentsInput {
  computed?: FeeComponent[];
  manual?: FeeComponent[];
  aggregate?: boolean;
}

export interface MergeAdjustmentComponentsInput {
  computed?: AdjustmentComponent[];
  manual?: AdjustmentComponent[];
  aggregate?: boolean;
}

export interface PartitionedFeeComponents {
  inLedger: FeeComponent[];
  separatePaymentOrder: FeeComponent[];
}

export interface PartitionedAdjustmentComponents {
  inLedger: AdjustmentComponent[];
  separatePaymentOrder: AdjustmentComponent[];
}

export interface SaveQuoteFeeComponentsInput {
  quoteId: string;
  components: FeeComponent[];
}

export interface GetQuoteFeeComponentsInput {
  quoteId: string;
}

export interface FeeComponentDefaults {
  bucket: string;
  transferCode: number;
  memo: string;
}

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
      if (!data.effectiveTo || !data.effectiveFrom) {
        return true;
      }

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
