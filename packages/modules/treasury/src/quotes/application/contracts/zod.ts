import { z } from "zod";

import { FINANCIAL_LINE_BUCKETS } from "@bedrock/documents/contracts";
import { parseMinorAmount } from "@bedrock/shared/money";
import { DAY_IN_SECONDS } from "@bedrock/shared/money/math";

import {
  currencySchema,
  feeDealDirectionSchema,
  feeDealFormSchema,
  positiveAmountSchema,
  positiveIntegerSchema,
  uuidSchema,
} from "../../../fees/application/contracts/zod";

function parseStrictMinorAmountString(value: string): bigint | null {
  if (value !== value.trim()) {
    return null;
  }

  return parseMinorAmount(value);
}

const positiveMinorAmountStringSchema = z
  .string()
  .refine((value) => parseStrictMinorAmountString(value) !== null, {
    message: "Must be a positive integer string",
  })
  .refine(
    (value) => {
      const parsed = parseStrictMinorAmountString(value);
      return parsed !== null && parsed > 0n;
    },
    { message: "Must be greater than zero" },
  );

const signedMinorAmountStringSchema = z
  .string()
  .refine((value) => parseStrictMinorAmountString(value) !== null, {
    message: "Must be an integer string",
  })
  .refine((value) => parseStrictMinorAmountString(value) !== 0n, {
    message: "Must be non-zero",
  });

const financialLineSourceSchema = z.enum(["rule", "manual"]);
const financialLineSettlementModeSchema = z.enum([
  "in_ledger",
  "separate_payment_order",
]);
const quoteLegSourceKindSchema = z.enum([
  "cb",
  "bank",
  "manual",
  "derived",
  "market",
]);
const quotePricingModeSchema = z.enum(["auto_cross", "explicit_route"]);
const quoteStatusSchema = z.enum(["active", "used", "expired", "cancelled"]);

export const QuoteFinancialLineSchema = z.object({
  id: z.string().min(1).max(128),
  bucket: z.enum(FINANCIAL_LINE_BUCKETS),
  currency: z.string().min(2).max(16),
  amountMinor: signedMinorAmountStringSchema,
  source: financialLineSourceSchema,
  settlementMode: financialLineSettlementModeSchema.optional(),
  memo: z.string().max(1_000).optional(),
  metadata: z.record(z.string(), z.string().max(255)).optional(),
});

export const QuoteLegInputSchema = z.object({
  fromCurrency: z.string().min(2).max(16),
  toCurrency: z.string().min(2).max(16),
  rateNum: positiveMinorAmountStringSchema,
  rateDen: positiveMinorAmountStringSchema,
  sourceKind: quoteLegSourceKindSchema,
  sourceRef: z.string().min(1).max(512).optional(),
  asOf: z.iso.datetime().optional(),
  executionCounterpartyId: z.uuid().optional(),
});

export const QuotePricingTraceSchema = z
  .object({
    version: z.literal("v1"),
    mode: quotePricingModeSchema,
    summary: z.string().max(2_000).optional(),
    steps: z.array(z.record(z.string(), z.unknown())).optional(),
    metadata: z.record(z.string(), z.string().max(255)).optional(),
  })
  .passthrough();

export const quoteMinorAmountInputSchema = z.union([
  positiveAmountSchema,
  positiveMinorAmountStringSchema.transform((value) => BigInt(value)),
]);

export const quoteDateInputSchema = z.union([
  z.date(),
  z.iso.datetime().transform((value) => new Date(value)),
]);

export const quoteFinancialLineInputSchema = z.union([
  QuoteFinancialLineSchema,
  z.object({
    id: z.string().min(1).max(128),
    bucket: z.enum(FINANCIAL_LINE_BUCKETS),
    currency: currencySchema,
    amountMinor: positiveMinorAmountStringSchema,
    source: financialLineSourceSchema,
    settlementMode: financialLineSettlementModeSchema.optional(),
    memo: z.string().max(1_000).optional(),
    metadata: z.record(z.string(), z.string().max(255)).optional(),
  }),
]).transform((line) => ({
  ...line,
  amountMinor:
    typeof line.amountMinor === "bigint"
      ? line.amountMinor
      : BigInt(line.amountMinor),
}));

export const quoteLegInputDataSchema = z.union([
  z.object({
    fromCurrency: currencySchema,
    toCurrency: currencySchema,
    rateNum: positiveAmountSchema,
    rateDen: positiveAmountSchema,
    sourceKind: quoteLegSourceKindSchema,
    sourceRef: z.string().min(1).max(512).optional(),
    asOf: z.date().optional(),
    executionCounterpartyId: uuidSchema.optional(),
  }),
  QuoteLegInputSchema.transform((leg) => ({
    ...leg,
    rateNum: BigInt(leg.rateNum),
    rateDen: BigInt(leg.rateDen),
    asOf: leg.asOf ? new Date(leg.asOf) : undefined,
  })),
]).refine((leg) => leg.fromCurrency !== leg.toCurrency, {
  message: "Leg currencies must be different",
});

export const pricingTraceInputSchema = QuotePricingTraceSchema.transform(
  (trace) => trace as Record<string, unknown>,
);

const quotePricingBaseSchema = z.object({
  fromCurrency: currencySchema,
  toCurrency: currencySchema,
  fromAmountMinor: quoteMinorAmountInputSchema,
  manualFinancialLines: z.array(quoteFinancialLineInputSchema).optional(),
  dealDirection: feeDealDirectionSchema.optional(),
  dealForm: feeDealFormSchema.optional(),
  ttlSeconds: positiveIntegerSchema
    .max(DAY_IN_SECONDS, "ttlSeconds cannot exceed 86400 (24 hours)")
    .optional(),
  asOf: quoteDateInputSchema,
});

export const QuotePricingInputSchema = z
  .union([
    quotePricingBaseSchema.extend({
      mode: z.literal("auto_cross"),
      anchor: currencySchema.optional(),
      pricingTrace: pricingTraceInputSchema.optional(),
    }),
    quotePricingBaseSchema.extend({
      mode: z.literal("explicit_route"),
      legs: z.array(quoteLegInputDataSchema).min(1),
      pricingTrace: pricingTraceInputSchema,
    }),
  ])
  .refine((data) => data.fromCurrency !== data.toCurrency, {
    message: "fromCurrency and toCurrency must be different",
  });

export {
  financialLineSettlementModeSchema,
  positiveMinorAmountStringSchema,
  quoteLegSourceKindSchema,
  quotePricingModeSchema,
  quoteStatusSchema,
};
