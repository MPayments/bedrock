import { z } from "zod";

import {
  compileManualFinancialLine,
  formatPercentFromBps,
  parseSignedPercentToBps,
} from "@bedrock/plugin-documents-sdk/financial-lines";
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

export const InvoiceModeSchema = z.enum(["direct", "exchange"]);
const financialLineCalcMethodSchema = z.enum(["fixed", "percent"]);

const directFinancialLineFixedInputSchema = z
  .object({
    calcMethod: z.literal("fixed").optional(),
    bucket: financialLineBucketSchema,
    currency: currencyCodeSchema,
    amount: amountValueSchema,
    memo: memoSchema,
  })
  .transform((input) => ({
    ...input,
    calcMethod: "fixed" as const,
  }));

const directFinancialLinePercentInputSchema = z
  .object({
    calcMethod: z.literal("percent"),
    bucket: financialLineBucketSchema,
    currency: currencyCodeSchema.optional(),
    percent: z.string().trim().min(1).max(32),
    memo: memoSchema,
  })
  .transform((input, ctx) => {
    try {
      return {
        ...input,
        percent: formatPercentFromBps(parseSignedPercentToBps(input.percent)),
      };
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message:
          error instanceof Error ? error.message : "percent is invalid",
        path: ["percent"],
      });
      return z.NEVER;
    }
  });

const directFinancialLineInputSchema = z.union([
  directFinancialLineFixedInputSchema,
  directFinancialLinePercentInputSchema,
]);

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

function resolveDirectFinancialLineErrorPath(
  error: unknown,
  index: number,
): [string, number, string] {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("currency")) {
    return ["financialLines", index, "currency"];
  }

  if (message.includes("percent")) {
    return ["financialLines", index, "percent"];
  }

  return ["financialLines", index, "amount"];
}

export function compileInvoiceDirectFinancialLines(input: {
  financialLines: DirectFinancialLineInput[];
  amountMinor: string;
  currency: string;
}) {
  return input.financialLines.map((line) =>
    financialLinePayloadSchema.parse(
      compileManualFinancialLine({
        line,
        baseAmountMinor: input.amountMinor,
        baseCurrency: input.currency,
      }),
    ),
  );
}

export const InvoiceDirectInputSchema = invoiceDirectInputBaseSchema.transform((input, ctx) => {
    try {
      const amountMinor = toMinorAmountString(input.amount, input.currency, {
        requirePositive: true,
      });

      let hasFinancialLineIssue = false;
      input.financialLines.forEach((line, index) => {
        try {
          compileManualFinancialLine({
            line,
            baseAmountMinor: amountMinor,
            baseCurrency: input.currency,
            createId: () => `manual:validation:${index}`,
          });
        } catch (error) {
          hasFinancialLineIssue = true;
          ctx.addIssue({
            code: "custom",
            message:
              error instanceof Error ? error.message : "financial line is invalid",
            path: resolveDirectFinancialLineErrorPath(error, index),
          });
        }
      });

      if (hasFinancialLineIssue) {
        return z.NEVER;
      }

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
