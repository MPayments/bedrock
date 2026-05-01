import { z } from "zod";

import {
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  referenceSchema,
} from "@bedrock/plugin-documents-sdk/validation/shared";
import {
  amountValueSchema,
  parseMinorAmount,
  toMinorAmountString,
} from "@bedrock/shared/money";

import {
  financialLineBucketSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema,
} from "./financial-lines";

const uuidSchema = z.uuid();
function parseStrictMinorAmountString(value: string): bigint | null {
  if (value !== value.trim()) {
    return null;
  }

  return parseMinorAmount(value);
}

const signedMinorAmountStringSchema = z
  .string()
  .refine((value) => parseStrictMinorAmountString(value) !== null, {
    message: "amountMinor must be an integer in minor units",
  })
  .refine((value) => parseStrictMinorAmountString(value) !== 0n, {
    message: "amountMinor must be non-zero",
  });
const positiveMinorAmountStringSchema = z
  .string()
  .refine((value) => parseStrictMinorAmountString(value) !== null, {
    message: "amountMinor must be a positive integer in minor units",
  })
  .refine(
    (value) => {
      const parsed = parseStrictMinorAmountString(value);
      return parsed !== null && parsed > 0n;
    },
    {
      message: "amountMinor must be positive",
    },
  );

const financialLineCalcMethodSchema = z.enum(["fixed", "percent"]);

const financialLinePayloadSchema = z.object({
  id: z.string().trim().min(1).max(128),
  bucket: financialLineBucketSchema,
  currency: currencyCodeSchema,
  amount: amountValueSchema,
  amountMinor: signedMinorAmountStringSchema,
  source: financialLineSourceSchema,
  settlementMode: financialLineSettlementModeSchema,
  memo: memoSchema,
  metadata: z.record(z.string(), z.string().max(255)).optional(),
  calcMethod: financialLineCalcMethodSchema.optional(),
  percentBps: z.number().int().optional(),
});

const quoteLegSnapshotSchema = z.object({
  idx: z.number().int().positive(),
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  fromAmountMinor: positiveMinorAmountStringSchema,
  toAmountMinor: positiveMinorAmountStringSchema,
  rateNum: positiveMinorAmountStringSchema,
  rateDen: positiveMinorAmountStringSchema,
  sourceKind: z.enum(["cb", "bank", "manual", "derived", "market"]),
  sourceRef: z.string().max(512).nullable(),
  asOf: z.iso.datetime(),
  executionCounterpartyId: uuidSchema.nullable(),
});

export const InvoicePurposeSchema = z.enum([
  "combined",
  "principal",
  "agency_fee",
]);

export const QuoteSnapshotSchema = z.object({
  quoteId: uuidSchema,
  quoteRef: z.string().trim().min(1).max(255),
  idempotencyKey: z.string().trim().min(1).max(255),
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  fromAmountMinor: positiveMinorAmountStringSchema,
  toAmountMinor: positiveMinorAmountStringSchema,
  pricingMode: z.enum(["auto_cross", "explicit_route"]),
  rateNum: positiveMinorAmountStringSchema,
  rateDen: positiveMinorAmountStringSchema,
  expiresAt: z.iso.datetime(),
  pricingTrace: z.record(z.string(), z.unknown()),
  legs: z.array(quoteLegSnapshotSchema).min(1),
  financialLines: z.array(financialLinePayloadSchema),
  snapshotHash: z.string().length(64),
});

const invoiceBaseInputSchema = baseOccurredAtSchema.extend({
  customerId: uuidSchema,
  counterpartyId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  memo: memoSchema,
  invoicePurpose: InvoicePurposeSchema.optional().default("combined"),
  billingSetRef: z.string().trim().min(1).max(255).optional(),
  quoteComponentIds: z.array(z.string().trim().min(1).max(255)).optional(),
});

const invoiceInputBaseSchema = invoiceBaseInputSchema.extend({
  amount: amountValueSchema,
  currency: currencyCodeSchema,
});

export const InvoiceInputSchema = invoiceInputBaseSchema.transform((input, ctx) => {
    try {
      const amountMinor = toMinorAmountString(input.amount, input.currency, {
        requirePositive: true,
      });

      return {
        ...input,
        amountMinor,
      };
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "amount is invalid",
      });
      return z.NEVER;
    }
  },
);

const invoiceBasePayloadSchema = baseOccurredAtSchema.extend({
  customerId: uuidSchema,
  counterpartyId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  memo: memoSchema,
  invoicePurpose: InvoicePurposeSchema.default("combined"),
  billingSetRef: z.string().trim().min(1).max(255).optional(),
  quoteComponentIds: z.array(z.string().trim().min(1).max(255)).default([]),
});

export const InvoiceCurrentPayloadSchema = invoiceBasePayloadSchema.extend({
  amount: amountValueSchema,
  amountMinor: positiveMinorAmountStringSchema,
  currency: currencyCodeSchema,
});
export const InvoicePayloadSchema = InvoiceCurrentPayloadSchema;

export const ApplicationInputSchema = baseOccurredAtSchema.extend({
  dealId: uuidSchema,
  quoteId: uuidSchema,
  calculationId: uuidSchema,
  customerId: uuidSchema,
  counterpartyId: uuidSchema,
  organizationId: uuidSchema,
  organizationRequisiteId: uuidSchema,
  memo: memoSchema,
});

export const ApplicationPayloadSchema = ApplicationInputSchema;

export const ExchangeInputSchema = baseOccurredAtSchema.extend({
  invoiceDocumentId: uuidSchema,
  executionRef: referenceSchema,
  memo: memoSchema,
});

export const ExchangePayloadSchema = baseOccurredAtSchema.extend({
  invoiceDocumentId: uuidSchema,
  customerId: uuidSchema,
  counterpartyId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  executionRef: referenceSchema,
  quoteSnapshot: QuoteSnapshotSchema,
  memo: memoSchema,
});

export const AcceptanceInputSchema = baseOccurredAtSchema.extend({
  applicationDocumentId: uuidSchema,
  invoiceDocumentId: uuidSchema.optional(),
  settlementEvidenceFileAssetIds: z.array(uuidSchema).optional().default([]),
  memo: memoSchema,
});

export const AcceptancePayloadSchema = baseOccurredAtSchema.extend({
  applicationDocumentId: uuidSchema,
  invoiceDocumentId: uuidSchema.optional(),
  settlementEvidenceFileAssetIds: z.array(uuidSchema).default([]),
  memo: memoSchema,
});

export type FinancialLinePayload = z.infer<typeof financialLinePayloadSchema>;
export type InvoicePurpose = z.infer<typeof InvoicePurposeSchema>;
export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSchema>;
export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;
export type InvoiceCurrentPayload = z.infer<typeof InvoiceCurrentPayloadSchema>;
export type InvoicePayload = z.infer<typeof InvoicePayloadSchema>;
export type ApplicationInput = z.infer<typeof ApplicationInputSchema>;
export type ApplicationPayload = z.infer<typeof ApplicationPayloadSchema>;
export type ExchangeInput = z.infer<typeof ExchangeInputSchema>;
export type ExchangePayload = z.infer<typeof ExchangePayloadSchema>;
export type AcceptanceInput = z.infer<typeof AcceptanceInputSchema>;
export type AcceptancePayload = z.infer<typeof AcceptancePayloadSchema>;
