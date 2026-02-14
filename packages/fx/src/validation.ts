import { z } from "zod";
import { normalizeCurrency, isValidCurrency } from "@bedrock/kernel";
import { feeDealDirectionSchema, feeDealFormSchema } from "@bedrock/fees";

const uuidSchema = z.string().uuid();

const currencySchema = z
    .string()
    .refine((val) => isValidCurrency(val), {
        message: "Currency must be 2-16 uppercase alphanumeric characters or underscores",
    })
    .transform((val) => normalizeCurrency(val));

const positiveAmountSchema = z.bigint().positive({ message: "Amount must be positive" });
const idempotencyKeySchema = z.string().min(1, "idempotencyKey is required").max(255);
const positiveBigintSchema = z.bigint().positive({ message: "Value must be positive" });
const nonNegativeIntegerSchema = z.number().int().min(0, { message: "Value must be non-negative" });
const positiveIntegerSchema = z.number().int().positive({ message: "Value must be positive" });

const quoteLegSourceKindSchema = z.enum(["cb", "bank", "manual", "derived", "market"]);

export const quoteLegInputSchema = z.object({
    fromCurrency: currencySchema,
    toCurrency: currencySchema,
    rateNum: positiveBigintSchema,
    rateDen: positiveBigintSchema,
    sourceKind: quoteLegSourceKindSchema,
    sourceRef: z.string().min(1).max(512).optional(),
    asOf: z.date().optional(),
    executionOrgId: uuidSchema.optional(),
}).refine((leg) => leg.fromCurrency !== leg.toCurrency, {
    message: "Leg currencies must be different",
});

export const pricingTraceSchema = z.object({
    version: z.literal("v1"),
    mode: z.enum(["auto_cross", "explicit_route"]),
    summary: z.string().max(2000).optional(),
    steps: z.array(z.record(z.string(), z.unknown())).optional(),
    metadata: z.record(z.string(), z.string().max(255)).optional(),
}).passthrough();

// UpsertPolicy input schema
export const upsertPolicyInputSchema = z.object({
    name: z.string().min(1, "name is required").max(255, "name cannot exceed 255 characters"),
    marginBps: nonNegativeIntegerSchema.max(10000, "marginBps cannot exceed 10000 (100%)"),
    feeBps: nonNegativeIntegerSchema.max(10000, "feeBps cannot exceed 10000 (100%)"),
    ttlSeconds: positiveIntegerSchema.max(86400, "ttlSeconds cannot exceed 86400 (24 hours)"),
});

export type UpsertPolicyInput = z.infer<typeof upsertPolicyInputSchema>;

// SetManualRate input schema
export const setManualRateInputSchema = z.object({
    base: currencySchema,
    quote: currencySchema,
    rateNum: positiveBigintSchema,
    rateDen: positiveBigintSchema,
    asOf: z.date(),
    source: z.string().min(1).max(100).optional(),
}).refine(
    (data) => data.base !== data.quote,
    { message: "base and quote currencies must be different" }
);

export type SetManualRateInput = z.infer<typeof setManualRateInputSchema>;

const quoteBaseSchema = z.object({
    idempotencyKey: idempotencyKeySchema,
    policyId: uuidSchema,
    fromCurrency: currencySchema,
    toCurrency: currencySchema,
    fromAmountMinor: positiveAmountSchema,
    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    asOf: z.date(),
});

const autoCrossQuoteSchema = quoteBaseSchema.extend({
    mode: z.literal("auto_cross"),
    anchor: currencySchema.optional(),
    pricingTrace: pricingTraceSchema.optional(),
});

const explicitRouteQuoteSchema = quoteBaseSchema.extend({
    mode: z.literal("explicit_route"),
    legs: z.array(quoteLegInputSchema).min(1),
    pricingTrace: pricingTraceSchema,
});

// Quote input schema
export const quoteInputSchema = z.union([autoCrossQuoteSchema, explicitRouteQuoteSchema]).refine(
    (data) => data.fromCurrency !== data.toCurrency,
    { message: "fromCurrency and toCurrency must be different" }
);

export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type QuoteLegInput = z.infer<typeof quoteLegInputSchema>;
export type PricingTrace = z.infer<typeof pricingTraceSchema>;

// MarkQuoteUsed input schema
export const markQuoteUsedInputSchema = z.object({
    quoteId: uuidSchema,
    usedByRef: z.string().min(1, "usedByRef is required").max(255),
    at: z.date(),
});

export type MarkQuoteUsedInput = z.infer<typeof markQuoteUsedInputSchema>;

export const getQuoteDetailsInputSchema = z.object({
    quoteRef: z.string().min(1).max(255),
});

export type GetQuoteDetailsInput = z.infer<typeof getQuoteDetailsInputSchema>;

import { ValidationError } from "./errors.js";

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

export function validateUpsertPolicyInput(input: unknown): UpsertPolicyInput {
    return validateInput(upsertPolicyInputSchema, input, "upsertPolicy");
}

export function validateSetManualRateInput(input: unknown): SetManualRateInput {
    return validateInput(setManualRateInputSchema, input, "setManualRate");
}

export function validateQuoteInput(input: unknown): QuoteInput {
    return validateInput(quoteInputSchema, input, "quote");
}

export function validateMarkQuoteUsedInput(input: unknown): MarkQuoteUsedInput {
    return validateInput(markQuoteUsedInputSchema, input, "markQuoteUsed");
}

export function validateGetQuoteDetailsInput(input: unknown): GetQuoteDetailsInput {
    return validateInput(getQuoteDetailsInputSchema, input, "getQuoteDetails");
}
