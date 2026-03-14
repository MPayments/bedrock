import { z } from "zod";

import {
  amountValueSchema,
  parseMinorAmount,
  toMinorAmountString,
} from "@bedrock/money";
import {
  financialLineBucketSchema,
  financialLineSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema,
} from "./financial-lines";
import {
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  referenceSchema,
} from "@bedrock/plugin-documents-sdk/validation/shared";

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

export const InvoiceModeSchema = z.enum(["direct", "exchange"]);

function toSignedMinorAmountString(input: {
  amount: string;
  currency: string;
}) {
  const amountMinor = toMinorAmountString(input.amount, input.currency);
  if (parseMinorAmount(amountMinor) === 0n) {
    throw new Error("amount must be non-zero");
  }

  return amountMinor;
}

const directFinancialLineInputSchema = z
  .object({
    bucket: financialLineBucketSchema,
    currency: currencyCodeSchema,
    amount: amountValueSchema,
    memo: memoSchema,
  })
  .transform((input, ctx) => {
    try {
      const amountMinor = toSignedMinorAmountString(input);

      return {
        id: `manual:${crypto.randomUUID()}`,
        bucket: input.bucket,
        currency: input.currency,
        amount: input.amount,
        amountMinor,
        source: "manual" as const,
        settlementMode:
          input.bucket === "pass_through"
            ? "separate_payment_order"
            : "in_ledger",
        memo: input.memo,
        metadata: undefined,
      };
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "amount is invalid",
      });
      return z.NEVER;
    }
  });

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
});

const invoiceDirectInputBaseSchema = invoiceBaseInputSchema.extend({
  mode: z.literal("direct"),
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  financialLines: z.array(directFinancialLineInputSchema).default([]),
});

export const InvoiceDirectInputSchema = invoiceDirectInputBaseSchema.transform(
  (input, ctx) => {
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

export const InvoiceExchangeInputSchema = invoiceBaseInputSchema.extend({
  mode: z.literal("exchange"),
  quoteRef: z.string().trim().min(1).max(255),
});

export const InvoiceInputSchema = z.discriminatedUnion("mode", [
  InvoiceDirectInputSchema,
  InvoiceExchangeInputSchema,
]);

const invoiceBasePayloadSchema = baseOccurredAtSchema.extend({
  customerId: uuidSchema,
  counterpartyId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  memo: memoSchema,
});

export const InvoiceDirectPayloadSchema = invoiceBasePayloadSchema.extend({
  mode: z.literal("direct"),
  amount: amountValueSchema,
  amountMinor: positiveMinorAmountStringSchema,
  currency: currencyCodeSchema,
  financialLines: z.array(financialLinePayloadSchema),
});

export const InvoiceExchangePayloadSchema = invoiceBasePayloadSchema.extend({
  mode: z.literal("exchange"),
  quoteSnapshot: QuoteSnapshotSchema,
});

export const InvoicePayloadSchema = z.discriminatedUnion("mode", [
  InvoiceDirectPayloadSchema,
  InvoiceExchangePayloadSchema,
]);

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
  invoiceDocumentId: uuidSchema,
  memo: memoSchema,
});

export const AcceptancePayloadSchema = baseOccurredAtSchema.extend({
  invoiceDocumentId: uuidSchema,
  exchangeDocumentId: uuidSchema.optional(),
  invoiceMode: InvoiceModeSchema,
  memo: memoSchema,
});

export type DirectFinancialLineInput = z.infer<
  typeof directFinancialLineInputSchema
>;
export type FinancialLinePayload = z.infer<typeof financialLinePayloadSchema>;
export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSchema>;
export type InvoiceDirectInput = z.infer<typeof InvoiceDirectInputSchema>;
export type InvoiceExchangeInput = z.infer<typeof InvoiceExchangeInputSchema>;
export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;
export type InvoiceDirectPayload = z.infer<typeof InvoiceDirectPayloadSchema>;
export type InvoiceExchangePayload = z.infer<
  typeof InvoiceExchangePayloadSchema
>;
export type InvoicePayload = z.infer<typeof InvoicePayloadSchema>;
export type ExchangeInput = z.infer<typeof ExchangeInputSchema>;
export type ExchangePayload = z.infer<typeof ExchangePayloadSchema>;
export type AcceptanceInput = z.infer<typeof AcceptanceInputSchema>;
export type AcceptancePayload = z.infer<typeof AcceptancePayloadSchema>;
