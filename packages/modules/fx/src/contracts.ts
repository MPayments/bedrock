import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/core/pagination";
import { parseMinorAmount } from "@bedrock/money";
import { FINANCIAL_LINE_BUCKETS } from "@bedrock/documents/financial-lines";
import { feeDealDirectionSchema, feeDealFormSchema } from "@bedrock/fees";
export {
  FX_QUOTES_LIST_CONTRACT,
  ListFxQuotesQuerySchema,
} from "./validation";

export const FxRateSourceSchema = z.enum(["cbr", "investing", "xe"]);
const financialLineSourceSchema = z.enum(["rule", "manual"]);
const financialLineSettlementModeSchema = z.enum([
  "in_ledger",
  "separate_payment_order",
]);
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
    {
      message: "Must be greater than zero",
    },
  );
const signedMinorAmountStringSchema = z
  .string()
  .refine((value) => parseStrictMinorAmountString(value) !== null, {
    message: "Must be an integer string",
  })
  .refine((value) => parseStrictMinorAmountString(value) !== 0n, {
    message: "Must be non-zero",
  });

export const FxRateSchema = z.object({
  source: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
  asOf: z.iso.datetime(),
  change: z.number().nullable(),
  changePercent: z.number().nullable(),
});

export const FxRatePairSchema = z.object({
  baseCurrencyCode: z.string(),
  quoteCurrencyCode: z.string(),
  bestRate: FxRateSchema,
  rates: z.array(FxRateSchema),
});

export const FxRatePairsResponseSchema = z.object({
  data: z.array(FxRatePairSchema),
});

export const FxRateHistoryPointSchema = z.object({
  source: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
  asOf: z.iso.datetime(),
});

export const FxRateHistoryResponseSchema = z.object({
  data: z.array(FxRateHistoryPointSchema),
});

export const FxRateSourceStatusSchema = z.object({
  source: FxRateSourceSchema,
  ttlSeconds: z.number().int().positive(),
  lastSyncedAt: z.iso.datetime().nullable(),
  lastPublishedAt: z.iso.datetime().nullable(),
  lastStatus: z.enum(["idle", "ok", "error"]),
  lastError: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  isExpired: z.boolean(),
});

export const FxRateSourceStatusesResponseSchema = z.object({
  data: z.array(FxRateSourceStatusSchema),
});

export const SetManualRateInputSchema = z.object({
  base: z.string().min(2).max(16),
  quote: z.string().min(2).max(16),
  rateNum: z.string().regex(/^\d+$/, "Must be a non-negative integer string"),
  rateDen: z.string().regex(/^\d+$/, "Must be a non-negative integer string"),
  asOf: z.coerce.date().optional(),
});

export const SetManualRateResponseSchema = z.object({
  ok: z.boolean(),
});

export const FxQuoteFinancialLineSchema = z.object({
  id: z.string().min(1).max(128),
  bucket: z.enum(FINANCIAL_LINE_BUCKETS),
  currency: z.string().min(2).max(16),
  amountMinor: signedMinorAmountStringSchema,
  source: financialLineSourceSchema,
  settlementMode: financialLineSettlementModeSchema.optional(),
  memo: z.string().max(1_000).optional(),
  metadata: z.record(z.string(), z.string().max(255)).optional(),
});

export const FxQuoteLegInputSchema = z.object({
  fromCurrency: z.string().min(2).max(16),
  toCurrency: z.string().min(2).max(16),
  rateNum: positiveMinorAmountStringSchema,
  rateDen: positiveMinorAmountStringSchema,
  sourceKind: z.enum(["cb", "bank", "manual", "derived", "market"]),
  sourceRef: z.string().min(1).max(512).optional(),
  asOf: z.iso.datetime().optional(),
  executionCounterpartyId: z.uuid().optional(),
});

export const FxQuotePricingTraceSchema = z
  .object({
    version: z.literal("v1"),
    mode: z.enum(["auto_cross", "explicit_route"]),
    summary: z.string().max(2_000).optional(),
    steps: z.array(z.record(z.string(), z.unknown())).optional(),
    metadata: z.record(z.string(), z.string().max(255)).optional(),
  })
  .passthrough();

export const CreateFxQuoteInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("auto_cross"),
    idempotencyKey: z.string().min(1).max(255),
    fromCurrency: z.string().min(2).max(16),
    toCurrency: z.string().min(2).max(16),
    fromAmountMinor: positiveMinorAmountStringSchema,
    manualFinancialLines: z.array(FxQuoteFinancialLineSchema).optional(),
    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    ttlSeconds: z.number().int().positive().max(86_400).optional(),
    asOf: z.iso.datetime(),
    anchor: z.string().min(2).max(16).optional(),
    pricingTrace: FxQuotePricingTraceSchema.optional(),
  }),
  z.object({
    mode: z.literal("explicit_route"),
    idempotencyKey: z.string().min(1).max(255),
    fromCurrency: z.string().min(2).max(16),
    toCurrency: z.string().min(2).max(16),
    fromAmountMinor: positiveMinorAmountStringSchema,
    manualFinancialLines: z.array(FxQuoteFinancialLineSchema).optional(),
    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    ttlSeconds: z.number().int().positive().max(86_400).optional(),
    asOf: z.iso.datetime(),
    legs: z.array(FxQuoteLegInputSchema).min(1),
    pricingTrace: FxQuotePricingTraceSchema,
  }),
]);

export const FxQuoteSchema = z.object({
  id: z.uuid(),
  fromCurrencyId: z.uuid(),
  toCurrencyId: z.uuid(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmountMinor: z.string(),
  toAmountMinor: z.string(),
  pricingMode: z.enum(["auto_cross", "explicit_route"]),
  pricingTrace: z.record(z.string(), z.unknown()),
  dealDirection: z.string().nullable(),
  dealForm: z.string().nullable(),
  rateNum: z.string(),
  rateDen: z.string(),
  status: z.enum(["active", "used", "expired", "cancelled"]),
  usedByRef: z.string().nullable(),
  usedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime(),
  idempotencyKey: z.string(),
  createdAt: z.iso.datetime(),
});

export const FxQuoteListItemSchema = FxQuoteSchema.extend({
  fromAmount: z.string(),
  toAmount: z.string(),
});

export const FxQuoteLegSchema = z.object({
  id: z.uuid(),
  quoteId: z.uuid(),
  idx: z.number().int().positive(),
  fromCurrencyId: z.uuid(),
  toCurrencyId: z.uuid(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmountMinor: z.string(),
  toAmountMinor: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
  sourceKind: z.enum(["cb", "bank", "manual", "derived", "market"]),
  sourceRef: z.string().nullable(),
  asOf: z.iso.datetime(),
  executionCounterpartyId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export const FxQuoteFeeComponentSchema = z.object({
  id: z.string(),
  ruleId: z.string().optional(),
  kind: z.string(),
  currency: z.string(),
  amountMinor: z.string(),
  source: z.enum(["rule", "manual"]),
  settlementMode: financialLineSettlementModeSchema.optional(),
  accountingTreatment: z.enum(["income", "pass_through", "expense"]).optional(),
  memo: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const FxQuoteDetailsResponseSchema = z.object({
  quote: FxQuoteSchema,
  legs: z.array(FxQuoteLegSchema),
  feeComponents: z.array(FxQuoteFeeComponentSchema),
  financialLines: z.array(FxQuoteFinancialLineSchema),
  pricingTrace: z.record(z.string(), z.unknown()),
});

export const FxQuoteListResponseSchema = createPaginatedListSchema(
  FxQuoteListItemSchema,
);

export type FxRatePair = z.infer<typeof FxRatePairSchema>;
export type FxRateHistoryPoint = z.infer<typeof FxRateHistoryPointSchema>;
export type FxRateSourceStatus = z.infer<typeof FxRateSourceStatusSchema>;
export type SetManualRateInput = z.infer<typeof SetManualRateInputSchema>;
export type CreateFxQuoteInput = z.infer<typeof CreateFxQuoteInputSchema>;
export type FxQuoteListItem = z.infer<typeof FxQuoteListItemSchema>;
export type FxQuoteListResponse = z.infer<typeof FxQuoteListResponseSchema>;
export type FxQuoteDetailsResponse = z.infer<
  typeof FxQuoteDetailsResponseSchema
>;
