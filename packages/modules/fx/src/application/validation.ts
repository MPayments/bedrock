import type { z } from "zod";
import { z as schemaBuilder } from "zod";

import { isValidCurrency, normalizeCurrency } from "@bedrock/currencies/catalog";
import { financialLineSchema } from "@bedrock/documents/contracts";
import {
  feeDealDirectionSchema,
  feeDealFormSchema,
} from "@bedrock/fees/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import { DAY_IN_SECONDS } from "@bedrock/shared/money/math";

import { ListFxQuotesQuerySchema } from "../contracts";

const uuidSchema = schemaBuilder.uuid({ version: "v4" });

const currencySchema = schemaBuilder
  .string()
  .refine((value) => isValidCurrency(value), {
    message:
      "Currency must be 2-16 uppercase alphanumeric characters or underscores",
  })
  .transform((value) => normalizeCurrency(value));

const positiveAmountSchema = schemaBuilder
  .bigint()
  .positive({ message: "Amount must be positive" });
const positiveBigintSchema = schemaBuilder
  .bigint()
  .positive({ message: "Value must be positive" });
const positiveIntegerSchema = schemaBuilder
  .number()
  .int()
  .positive({ message: "Value must be positive" });
const idempotencyKeySchema = schemaBuilder.string().min(1).max(255);
const rateSourceSchema = schemaBuilder.enum(["cbr", "investing", "xe"]);
const quoteLegSourceKindSchema = schemaBuilder.enum([
  "cb",
  "bank",
  "manual",
  "derived",
  "market",
]);

const quoteLegInputSchema = schemaBuilder
  .object({
    fromCurrency: currencySchema,
    toCurrency: currencySchema,
    rateNum: positiveBigintSchema,
    rateDen: positiveBigintSchema,
    sourceKind: quoteLegSourceKindSchema,
    sourceRef: schemaBuilder.string().min(1).max(512).optional(),
    asOf: schemaBuilder.date().optional(),
    executionCounterpartyId: uuidSchema.optional(),
  })
  .refine((leg) => leg.fromCurrency !== leg.toCurrency, {
    message: "Leg currencies must be different",
  });

const pricingTraceSchema = schemaBuilder
  .object({
    version: schemaBuilder.literal("v1"),
    mode: schemaBuilder.enum(["auto_cross", "explicit_route"]),
    summary: schemaBuilder.string().max(2_000).optional(),
    steps: schemaBuilder
      .array(schemaBuilder.record(schemaBuilder.string(), schemaBuilder.unknown()))
      .optional(),
    metadata: schemaBuilder
      .record(schemaBuilder.string(), schemaBuilder.string().max(255))
      .optional(),
  })
  .passthrough();

const setManualRateInputSchema = schemaBuilder
  .object({
    base: currencySchema,
    quote: currencySchema,
    rateNum: positiveBigintSchema,
    rateDen: positiveBigintSchema,
    asOf: schemaBuilder.date(),
    source: schemaBuilder
      .string()
      .min(1)
      .max(100)
      .refine(
        (source) => !["cbr", "investing", "xe"].includes(source.toLowerCase()),
        "source 'cbr', 'investing' and 'xe' are reserved for external provider sync",
      )
      .optional(),
  })
  .refine((data) => data.base !== data.quote, {
    message: "base and quote currencies must be different",
  });

const syncRatesFromSourceInputSchema = schemaBuilder.object({
  source: rateSourceSchema,
  force: schemaBuilder.boolean().optional(),
  now: schemaBuilder.date().optional(),
});

const quoteBaseSchema = schemaBuilder.object({
  idempotencyKey: idempotencyKeySchema,
  fromCurrency: currencySchema,
  toCurrency: currencySchema,
  fromAmountMinor: positiveAmountSchema,
  manualFinancialLines: schemaBuilder.array(financialLineSchema).optional(),
  dealDirection: feeDealDirectionSchema.optional(),
  dealForm: feeDealFormSchema.optional(),
  ttlSeconds: positiveIntegerSchema
    .max(DAY_IN_SECONDS, "ttlSeconds cannot exceed 86400 (24 hours)")
    .optional(),
  asOf: schemaBuilder.date(),
});

const autoCrossQuoteSchema = quoteBaseSchema.extend({
  mode: schemaBuilder.literal("auto_cross"),
  anchor: currencySchema.optional(),
  pricingTrace: pricingTraceSchema.optional(),
});

const explicitRouteQuoteSchema = quoteBaseSchema.extend({
  mode: schemaBuilder.literal("explicit_route"),
  legs: schemaBuilder.array(quoteLegInputSchema).min(1),
  pricingTrace: pricingTraceSchema,
});

const quoteInputSchema = schemaBuilder
  .union([autoCrossQuoteSchema, explicitRouteQuoteSchema])
  .refine((data) => data.fromCurrency !== data.toCurrency, {
    message: "fromCurrency and toCurrency must be different",
  });

const markQuoteUsedInputSchema = schemaBuilder.object({
  quoteId: uuidSchema,
  usedByRef: schemaBuilder.string().min(1).max(255),
  at: schemaBuilder.date(),
});

const getQuoteDetailsInputSchema = schemaBuilder.object({
  quoteRef: schemaBuilder.string().min(1).max(255),
});

export type SetManualRateInput = z.infer<typeof setManualRateInputSchema>;
export type SyncRatesFromSourceInput = z.infer<
  typeof syncRatesFromSourceInputSchema
>;
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type MarkQuoteUsedInput = z.infer<typeof markQuoteUsedInputSchema>;
export type GetQuoteDetailsInput = z.infer<typeof getQuoteDetailsInputSchema>;
export type ListFxQuotesQuery = z.infer<typeof ListFxQuotesQuerySchema>;

export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: string,
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.issues[0];

    if (!firstError) {
      throw new ValidationError(
        `Validation failed${context ? ` for ${context}` : ""}: ${result.error.message || "Unknown error"}`,
      );
    }

    const path = firstError.path.join(".");
    const message = path ? `${path}: ${firstError.message}` : firstError.message;

    throw new ValidationError(`${context ? `${context}: ` : ""}${message}`);
  }

  return result.data;
}

export function validateSetManualRateInput(input: unknown): SetManualRateInput {
  return validateInput(setManualRateInputSchema, input, "setManualRate");
}

export function validateSyncRatesFromSourceInput(
  input: unknown,
): SyncRatesFromSourceInput {
  return validateInput(syncRatesFromSourceInputSchema, input, "syncRatesFromSource");
}

export function validateQuoteInput(input: unknown): QuoteInput {
  return validateInput(quoteInputSchema, input, "quote");
}

export function validateMarkQuoteUsedInput(input: unknown): MarkQuoteUsedInput {
  return validateInput(markQuoteUsedInputSchema, input, "markQuoteUsed");
}

export function validateGetQuoteDetailsInput(
  input: unknown,
): GetQuoteDetailsInput {
  return validateInput(getQuoteDetailsInputSchema, input, "getQuoteDetails");
}

export function validateListFxQuotesQuery(input: unknown): ListFxQuotesQuery {
  return validateInput(ListFxQuotesQuerySchema, input, "listQuotes");
}
