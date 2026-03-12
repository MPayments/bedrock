import { z } from "zod";

import { financialLineSchema } from "@bedrock/application/commercial-documents/contracts";
import { normalizeCurrency, isValidCurrency } from "@bedrock/application/currencies/catalog";
import { feeDealDirectionSchema, feeDealFormSchema } from "@bedrock/application/fees";
import { DAY_IN_SECONDS } from "@bedrock/application/ledger/constants";
import { ValidationError } from "@bedrock/common/errors";

const uuidSchema = z.uuid({ version: "v4" });

const currencySchema = z
    .string()
    .refine((val) => isValidCurrency(val), {
        message: "Currency must be 2-16 uppercase alphanumeric characters or underscores",
    })
    .transform((val) => normalizeCurrency(val));

const positiveAmountSchema = z.bigint().positive({ message: "Amount must be positive" });
const idempotencyKeySchema = z.string().min(1, "idempotencyKey is required").max(255);
const positiveBigintSchema = z.bigint().positive({ message: "Value must be positive" });
const positiveIntegerSchema = z.number().int().positive({ message: "Value must be positive" });
const rateSourceSchema = z.enum(["cbr", "investing", "xe"]);

const quoteLegSourceKindSchema = z.enum(["cb", "bank", "manual", "derived", "market"]);

export const QuoteLegInputSchema = z.object({
    fromCurrency: currencySchema,
    toCurrency: currencySchema,
    rateNum: positiveBigintSchema,
    rateDen: positiveBigintSchema,
    sourceKind: quoteLegSourceKindSchema,
    sourceRef: z.string().min(1).max(512).optional(),
    asOf: z.date().optional(),
    executionCounterpartyId: uuidSchema.optional(),
}).refine((leg) => leg.fromCurrency !== leg.toCurrency, {
    message: "Leg currencies must be different",
});

export const PricingTraceSchema = z.object({
    version: z.literal("v1"),
    mode: z.enum(["auto_cross", "explicit_route"]),
    summary: z.string().max(2000).optional(),
    steps: z.array(z.record(z.string(), z.unknown())).optional(),
    metadata: z.record(z.string(), z.string().max(255)).optional(),
}).passthrough();

// SetManualRate input schema
const setManualRateInputSchema = z.object({
    base: currencySchema,
    quote: currencySchema,
    rateNum: positiveBigintSchema,
    rateDen: positiveBigintSchema,
    asOf: z.date(),
    source: z
        .string()
        .min(1)
        .max(100)
        .refine((source) => !["cbr", "investing", "xe"].includes(source.toLowerCase()), "source 'cbr', 'investing' and 'xe' are reserved for external provider sync")
        .optional(),
}).refine(
    (data) => data.base !== data.quote,
    { message: "base and quote currencies must be different" }
);

export type SetManualRateInput = z.infer<typeof setManualRateInputSchema>;

const syncRatesFromSourceInputSchema = z.object({
    source: rateSourceSchema,
    force: z.boolean().optional(),
    now: z.date().optional(),
});

export type SyncRatesFromSourceInput = z.infer<typeof syncRatesFromSourceInputSchema>;

const quoteBaseSchema = z.object({
    idempotencyKey: idempotencyKeySchema,
    fromCurrency: currencySchema,
    toCurrency: currencySchema,
    fromAmountMinor: positiveAmountSchema,
    manualFinancialLines: z.array(financialLineSchema).optional(),
    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    ttlSeconds: positiveIntegerSchema.max(DAY_IN_SECONDS, "ttlSeconds cannot exceed 86400 (24 hours)").optional(),
    asOf: z.date(),
});

const autoCrossQuoteSchema = quoteBaseSchema.extend({
    mode: z.literal("auto_cross"),
    anchor: currencySchema.optional(),
    pricingTrace: PricingTraceSchema.optional(),
});

const explicitRouteQuoteSchema = quoteBaseSchema.extend({
    mode: z.literal("explicit_route"),
    legs: z.array(QuoteLegInputSchema).min(1),
    pricingTrace: PricingTraceSchema,
});

// Quote input schema
export const QuoteInputSchema = z.union([autoCrossQuoteSchema, explicitRouteQuoteSchema]).refine(
    (data) => data.fromCurrency !== data.toCurrency,
    { message: "fromCurrency and toCurrency must be different" }
);

export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteLegInput = z.infer<typeof QuoteLegInputSchema>;
export type PricingTrace = z.infer<typeof PricingTraceSchema>;

// MarkQuoteUsed input schema
const markQuoteUsedInputSchema = z.object({
    quoteId: uuidSchema,
    usedByRef: z.string().min(1, "usedByRef is required").max(255),
    at: z.date(),
});

export type MarkQuoteUsedInput = z.infer<typeof markQuoteUsedInputSchema>;

export const GetQuoteDetailsInputSchema = z.object({
    quoteRef: z.string().min(1).max(255),
});

export type GetQuoteDetailsInput = z.infer<typeof GetQuoteDetailsInputSchema>;

export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown, context?: string): T {
    const result = schema.safeParse(input);

    if (!result.success) {
        const errors = result.error.issues;
        if (!errors || errors.length === 0) {
            throw new ValidationError(`Validation failed${context ? ` for ${context}` : ""}: ${result.error.message || "Unknown error"}`);
        }

        const firstError = errors[0]!;
        const path = firstError.path.join(".");
        const message = path ? `${path}: ${firstError.message}` : firstError.message;

        throw new ValidationError(`${context ? `${context}: ` : ""}${message}`);
    }

    return result.data;
}

export function validateSetManualRateInput(input: unknown): SetManualRateInput {
    return validateInput(setManualRateInputSchema, input, "setManualRate");
}

export function validateSyncRatesFromSourceInput(input: unknown): SyncRatesFromSourceInput {
    return validateInput(syncRatesFromSourceInputSchema, input, "syncRatesFromSource");
}

export function validateQuoteInput(input: unknown): QuoteInput {
    return validateInput(QuoteInputSchema, input, "quote");
}

export function validateMarkQuoteUsedInput(input: unknown): MarkQuoteUsedInput {
    return validateInput(markQuoteUsedInputSchema, input, "markQuoteUsed");
}

export function validateGetQuoteDetailsInput(input: unknown): GetQuoteDetailsInput {
    return validateInput(GetQuoteDetailsInputSchema, input, "getQuoteDetails");
}
