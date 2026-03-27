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

const positiveMinorAmountStringSchema = z
  .string()
  .refine((value) => parseStrictMinorAmountString(value) !== null, {
    message: "amountMinor must be a positive integer in minor units",
  })
  .refine((value) => {
    const parsed = parseStrictMinorAmountString(value);
    return parsed !== null && parsed > 0n;
  }, {
    message: "amountMinor must be positive",
  });

const nonEmptyStringSchema = z.string().trim().min(1).max(255);

export const CommercialContourSchema = z.enum(["rf", "intl"]);
export const PaymentOrderExecutionStatusSchema = z.enum([
  "prepared",
  "sent",
  "settled",
  "void",
  "failed",
]);

export const ExternalBasisInputSchema = z
  .object({
    sourceSystem: z.string().trim().min(1).max(128),
    entityType: z.string().trim().min(1).max(128),
    entityId: z.string().trim().min(1).max(255),
    documentNumber: z.string().trim().min(1).max(255).optional(),
  })
  .transform((input) => ({
    ...input,
    documentNumber: input.documentNumber ?? null,
  }));

export const ExternalBasisPayloadSchema = z.object({
  sourceSystem: z.string().trim().min(1).max(128),
  entityType: z.string().trim().min(1).max(128),
  entityId: z.string().trim().min(1).max(255),
  documentNumber: z.string().trim().min(1).max(255).nullable(),
});

const financialLinePayloadSchema = z.object({
  id: z.string().trim().min(1).max(128),
  bucket: financialLineBucketSchema,
  currency: currencyCodeSchema,
  amount: amountValueSchema,
  amountMinor: z.string().trim().min(1),
  source: financialLineSourceSchema,
  settlementMode: financialLineSettlementModeSchema,
  memo: memoSchema,
  metadata: z.record(z.string(), z.string().max(255)).optional(),
  calcMethod: z.enum(["fixed", "percent"]).optional(),
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

const incomingInvoiceBaseSchema = baseOccurredAtSchema.extend({
  contour: CommercialContourSchema,
  customerId: uuidSchema,
  counterpartyId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  externalBasis: ExternalBasisInputSchema.optional(),
  memo: memoSchema,
});

export const IncomingInvoiceInputSchema = incomingInvoiceBaseSchema.transform(
  (input) => ({
    ...input,
    amountMinor: toMinorAmountString(input.amount, input.currency, {
      requirePositive: true,
    }),
  }),
);

export const IncomingInvoicePayloadSchema = baseOccurredAtSchema.extend({
  contour: CommercialContourSchema,
  customerId: uuidSchema,
  counterpartyId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  amount: amountValueSchema,
  amountMinor: positiveMinorAmountStringSchema,
  currency: currencyCodeSchema,
  externalBasis: ExternalBasisPayloadSchema.optional(),
  memo: memoSchema,
});

const outgoingInvoiceBaseSchema = baseOccurredAtSchema.extend({
  contour: CommercialContourSchema,
  counterpartyId: uuidSchema,
  counterpartyRequisiteId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  memo: memoSchema,
});

export const OutgoingInvoiceInputSchema = outgoingInvoiceBaseSchema.transform(
  (input) => ({
    ...input,
    amountMinor: toMinorAmountString(input.amount, input.currency, {
      requirePositive: true,
    }),
  }),
);

export const OutgoingInvoicePayloadSchema = baseOccurredAtSchema.extend({
  contour: CommercialContourSchema,
  counterpartyId: uuidSchema,
  counterpartyRequisiteId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  amount: amountValueSchema,
  amountMinor: positiveMinorAmountStringSchema,
  currency: currencyCodeSchema,
  memo: memoSchema,
});

const paymentOrderBaseSchema = baseOccurredAtSchema.extend({
  contour: CommercialContourSchema,
  incomingInvoiceDocumentId: uuidSchema,
  sourcePaymentOrderDocumentId: uuidSchema.optional(),
  counterpartyId: uuidSchema,
  counterpartyRequisiteId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  amount: amountValueSchema,
  currency: currencyCodeSchema,
  allocatedCurrency: currencyCodeSchema,
  executionStatus: PaymentOrderExecutionStatusSchema.default("sent"),
  executionRef: referenceSchema,
  memo: memoSchema,
});

export const PaymentOrderInputSchema = paymentOrderBaseSchema.transform(
  (input) => ({
    ...input,
    amountMinor: toMinorAmountString(input.amount, input.currency, {
      requirePositive: true,
    }),
  }),
);

export const PaymentOrderPayloadSchema = baseOccurredAtSchema.extend({
  contour: CommercialContourSchema,
  incomingInvoiceDocumentId: uuidSchema,
  sourcePaymentOrderDocumentId: uuidSchema.optional(),
  customerId: uuidSchema,
  counterpartyId: uuidSchema,
  counterpartyRequisiteId: uuidSchema,
  organizationId: uuidSchema.optional(),
  organizationRequisiteId: uuidSchema,
  fundingAmount: amountValueSchema,
  fundingAmountMinor: positiveMinorAmountStringSchema,
  fundingCurrency: currencyCodeSchema,
  allocatedAmount: amountValueSchema,
  allocatedAmountMinor: positiveMinorAmountStringSchema,
  allocatedCurrency: currencyCodeSchema,
  executionStatus: PaymentOrderExecutionStatusSchema,
  executionRef: referenceSchema,
  quoteSnapshot: QuoteSnapshotSchema.optional(),
  memo: memoSchema,
});

export const CommercialDocumentReferenceSchema = z.object({
  incomingInvoiceDocumentId: uuidSchema.optional(),
  paymentOrderDocumentId: uuidSchema.optional(),
  outgoingInvoiceDocumentId: uuidSchema.optional(),
});

export type CommercialContour = z.infer<typeof CommercialContourSchema>;
export type PaymentOrderExecutionStatus = z.infer<
  typeof PaymentOrderExecutionStatusSchema
>;
export type ExternalBasisInput = z.infer<typeof ExternalBasisInputSchema>;
export type ExternalBasisPayload = z.infer<typeof ExternalBasisPayloadSchema>;
export type FinancialLinePayload = z.infer<typeof financialLinePayloadSchema>;
export type QuoteSnapshot = z.infer<typeof QuoteSnapshotSchema>;
export type IncomingInvoiceInput = z.infer<typeof IncomingInvoiceInputSchema>;
export type IncomingInvoicePayload = z.infer<typeof IncomingInvoicePayloadSchema>;
export type OutgoingInvoiceInput = z.infer<typeof OutgoingInvoiceInputSchema>;
export type OutgoingInvoicePayload = z.infer<typeof OutgoingInvoicePayloadSchema>;
export type PaymentOrderInput = z.infer<typeof PaymentOrderInputSchema>;
export type PaymentOrderPayload = z.infer<typeof PaymentOrderPayloadSchema>;

export function normalizePaymentOrderReference(value: unknown): string {
  return nonEmptyStringSchema.parse(value);
}
