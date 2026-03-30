import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import type {
  QuoteLegInputSchema,
  QuotePricingTraceSchema} from "./zod";
import {
  QuoteFinancialLineSchema,
  financialLineSettlementModeSchema,
  quoteLegSourceKindSchema,
  quotePricingModeSchema,
  quoteStatusSchema,
} from "./zod";

export const QuoteSchema = z.object({
  id: z.uuid(),
  fromCurrencyId: z.uuid(),
  toCurrencyId: z.uuid(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmountMinor: z.string(),
  toAmountMinor: z.string(),
  pricingMode: quotePricingModeSchema,
  pricingTrace: z.record(z.string(), z.unknown()),
  dealDirection: z.string().nullable(),
  dealForm: z.string().nullable(),
  rateNum: z.string(),
  rateDen: z.string(),
  status: quoteStatusSchema,
  dealId: z.uuid().nullable(),
  usedByRef: z.string().nullable(),
  usedDocumentId: z.uuid().nullable(),
  usedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime(),
  idempotencyKey: z.string(),
  createdAt: z.iso.datetime(),
});

export const QuoteListItemSchema = QuoteSchema.extend({
  fromAmount: z.string(),
  toAmount: z.string(),
});

export const QuoteLegSchema = z.object({
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
  sourceKind: quoteLegSourceKindSchema,
  sourceRef: z.string().nullable(),
  asOf: z.iso.datetime(),
  executionCounterpartyId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
});

export const QuotePreviewLegSchema = z.object({
  idx: z.number().int().positive(),
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmountMinor: z.string(),
  toAmountMinor: z.string(),
  rateNum: z.string(),
  rateDen: z.string(),
  sourceKind: quoteLegSourceKindSchema,
  sourceRef: z.string().nullable(),
  asOf: z.iso.datetime(),
  executionCounterpartyId: z.uuid().nullable(),
});

export const QuoteFeeComponentSchema = z.object({
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

export const QuoteDetailsResponseSchema = z.object({
  quote: QuoteSchema,
  legs: z.array(QuoteLegSchema),
  feeComponents: z.array(QuoteFeeComponentSchema),
  financialLines: z.array(QuoteFinancialLineSchema),
  pricingTrace: z.record(z.string(), z.unknown()),
});

export const QuotePreviewResponseSchema = z.object({
  fromCurrency: z.string(),
  toCurrency: z.string(),
  fromAmountMinor: z.string(),
  toAmountMinor: z.string(),
  fromAmount: z.string(),
  toAmount: z.string(),
  pricingMode: quotePricingModeSchema,
  pricingTrace: z.record(z.string(), z.unknown()),
  dealDirection: z.string().nullable(),
  dealForm: z.string().nullable(),
  rateNum: z.string(),
  rateDen: z.string(),
  expiresAt: z.iso.datetime(),
  legs: z.array(QuotePreviewLegSchema),
  feeComponents: z.array(QuoteFeeComponentSchema),
  financialLines: z.array(QuoteFinancialLineSchema),
});

export const QuoteListResponseSchema = createPaginatedListSchema(
  QuoteListItemSchema,
);

export type QuoteFinancialLine = z.infer<typeof QuoteFinancialLineSchema>;
export type QuoteLegInput = z.infer<typeof QuoteLegInputSchema>;
export type QuotePricingTrace = z.infer<typeof QuotePricingTraceSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type QuoteListItem = z.infer<typeof QuoteListItemSchema>;
export type QuoteLeg = z.infer<typeof QuoteLegSchema>;
export type QuotePreviewLeg = z.infer<typeof QuotePreviewLegSchema>;
export type QuoteFeeComponent = z.infer<typeof QuoteFeeComponentSchema>;
export type QuoteDetailsResponse = z.infer<typeof QuoteDetailsResponseSchema>;
export type QuotePreviewResponse = z.infer<typeof QuotePreviewResponseSchema>;
export type QuoteListResponse = z.infer<typeof QuoteListResponseSchema>;
