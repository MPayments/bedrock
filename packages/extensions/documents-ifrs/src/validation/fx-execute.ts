import { z } from "zod";

import {
  financialLineBucketSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema,
} from "@bedrock/documents/financial-lines";
import {
  amountValueSchema,
  parseMinorAmount,
  toMinorAmountString,
} from "@bedrock/money";

import {
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  referenceSchema,
} from "./shared";

const uuidSchema = z.uuid();
type FinancialLineSettlementMode = z.infer<
  typeof financialLineSettlementModeSchema
>;
type FinancialLineSource = z.infer<typeof financialLineSourceSchema>;

function parseStrictMinorAmountString(value: string): bigint | null {
  if (value !== value.trim()) {
    return null;
  }

  return parseMinorAmount(value);
}

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

const fxExecuteFinancialLineInputSchema = z
  .object({
    bucket: financialLineBucketSchema,
    currency: currencyCodeSchema,
    amount: amountValueSchema,
    memo: memoSchema,
  })
  .transform((input, ctx) => {
    try {
      const amountMinor = toSignedMinorAmountString(input);
      const source: FinancialLineSource = "manual";
      const settlementMode: FinancialLineSettlementMode =
        input.bucket === "pass_through"
          ? "separate_payment_order"
          : "in_ledger";

      return {
        id: `manual:${crypto.randomUUID()}`,
        bucket: input.bucket,
        currency: input.currency,
        amount: input.amount,
        amountMinor,
        source,
        settlementMode,
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

export const FxExecuteFinancialLinePayloadSchema = z.object({
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

export const FxExecuteQuoteSnapshotSchema = z.object({
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
  financialLines: z.array(FxExecuteFinancialLinePayloadSchema),
  snapshotHash: z.string().length(64),
});

export const FxExecuteOwnershipModeSchema = z.enum([
  "intra_org",
  "cross_org",
]);

export const FxExecuteInputSchema = baseOccurredAtSchema.extend({
  sourceRequisiteId: uuidSchema,
  destinationRequisiteId: uuidSchema,
  quoteRef: z.string().trim().min(1).max(255),
  executionRef: referenceSchema,
  timeoutSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 60 * 60)
    .optional(),
  memo: memoSchema,
  financialLines: z.array(fxExecuteFinancialLineInputSchema).default([]),
});

export const FxExecutePayloadSchema = baseOccurredAtSchema.extend({
  ownershipMode: FxExecuteOwnershipModeSchema,
  sourceOrganizationId: uuidSchema,
  sourceRequisiteId: uuidSchema,
  destinationOrganizationId: uuidSchema,
  destinationRequisiteId: uuidSchema,
  quoteSnapshot: FxExecuteQuoteSnapshotSchema,
  executionRef: referenceSchema,
  timeoutSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 60 * 60)
    .optional(),
  memo: memoSchema,
  financialLines: z.array(FxExecuteFinancialLinePayloadSchema),
});

export type FxExecuteFinancialLineInput = z.infer<
  typeof fxExecuteFinancialLineInputSchema
>;
export type FxExecuteFinancialLinePayload = z.infer<
  typeof FxExecuteFinancialLinePayloadSchema
>;
export type FxExecuteQuoteSnapshot = z.infer<
  typeof FxExecuteQuoteSnapshotSchema
>;
export type FxExecuteInput = z.infer<typeof FxExecuteInputSchema>;
export type FxExecutePayload = z.infer<typeof FxExecutePayloadSchema>;
