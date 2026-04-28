import { z } from "zod";

import {
  financialLineBucketSchema,
  financialLineSettlementModeSchema,
  financialLineSourceSchema,
} from "@bedrock/documents/contracts";
import {
  compileManualFinancialLine,
  formatPercentFromBps,
  parseSignedPercentToBps,
} from "@bedrock/plugin-documents-sdk/financial-lines";
import {
  amountValueSchema,
  parseMinorAmount,
  toMinorAmountString,
} from "@bedrock/shared/money";

import {
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  referenceSchema,
} from "./shared";

const uuidSchema = z.uuid();
const financialLineCalcMethodSchema = z.enum(["fixed", "percent"]);

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

const fxExecuteFinancialLineFixedInputSchema = z
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

const fxExecuteFinancialLinePercentInputSchema = z
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

const fxExecuteFinancialLineInputSchema = z.union([
  fxExecuteFinancialLineFixedInputSchema,
  fxExecuteFinancialLinePercentInputSchema,
]);

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

export const FxExecuteQuoteSnapshotSchema = z.object({
  quoteId: uuidSchema,
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

function resolveFxExecuteFinancialLineErrorPath(
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

export function compileFxExecuteManualFinancialLines(input: {
  financialLines: FxExecuteFinancialLineInput[];
  amountMinor: string;
  currency: string;
}) {
  return input.financialLines.map((line) =>
    FxExecuteFinancialLinePayloadSchema.parse(
      compileManualFinancialLine({
        line,
        baseAmountMinor: input.amountMinor,
        baseCurrency: input.currency,
      }),
    ),
  );
}

export const FxExecuteInputSchema = baseOccurredAtSchema
  .extend({
    sourceRequisiteId: uuidSchema,
    destinationRequisiteId: uuidSchema,
    quoteId: uuidSchema.optional(),
    amount: amountValueSchema,
    currency: z.string().trim().optional(),
    executionRef: referenceSchema,
    timeoutSeconds: z
      .number()
      .int()
      .positive()
      .max(7 * 24 * 60 * 60)
      .optional(),
    memo: memoSchema,
    financialLines: z.array(fxExecuteFinancialLineInputSchema).default([]),
  })
  .transform((input, ctx) => {
    if (input.currency === undefined) {
      return input;
    }

    const baseCurrency = input.currency.trim().toUpperCase();
    if (baseCurrency.length === 0) {
      input.financialLines.forEach((line, index) => {
        if (line.calcMethod !== "percent") {
          return;
        }

        ctx.addIssue({
          code: "custom",
          message:
            "percent-based financial lines require a resolved base currency",
          path: ["financialLines", index, "currency"],
        });
      });

      return z.NEVER;
    }

    try {
      const amountMinor = toMinorAmountString(input.amount, baseCurrency, {
        requirePositive: true,
      });

      let hasFinancialLineIssue = false;
      input.financialLines.forEach((line, index) => {
        try {
          compileManualFinancialLine({
            line,
            baseAmountMinor: amountMinor,
            baseCurrency,
            createId: () => `manual:validation:${index}`,
          });
        } catch (error) {
          hasFinancialLineIssue = true;
          ctx.addIssue({
            code: "custom",
            message:
              error instanceof Error ? error.message : "financial line is invalid",
            path: resolveFxExecuteFinancialLineErrorPath(error, index),
          });
        }
      });

      if (hasFinancialLineIssue) {
        return z.NEVER;
      }

      return {
        ...input,
        currency: baseCurrency,
      };
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "amount is invalid",
        path: ["amount"],
      });
      return z.NEVER;
    }
  });

export const FxExecutePayloadSchema = baseOccurredAtSchema.extend({
  ownershipMode: FxExecuteOwnershipModeSchema,
  sourceOrganizationId: uuidSchema,
  sourceRequisiteId: uuidSchema,
  destinationOrganizationId: uuidSchema,
  destinationRequisiteId: uuidSchema,
  amount: amountValueSchema,
  amountMinor: positiveMinorAmountStringSchema,
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
