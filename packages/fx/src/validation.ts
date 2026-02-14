import { z } from "zod";
import { normalizeCurrency, isValidCurrency } from "@bedrock/kernel";
import { feeDealDirectionSchema, feeDealFormSchema } from "@bedrock/fees";

// Shared schemas
const uuidSchema = z.uuid({
    version: "v4",
});

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

// Quote input schema
export const quoteInputSchema = z.object({
    idempotencyKey: idempotencyKeySchema,
    policyId: uuidSchema,
    fromCurrency: currencySchema,
    toCurrency: currencySchema,
    fromAmountMinor: positiveAmountSchema,
    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    asOf: z.date(),
    anchor: currencySchema.optional(),
}).refine(
    (data) => data.fromCurrency !== data.toCurrency,
    { message: "fromCurrency and toCurrency must be different" }
);

export type QuoteInput = z.infer<typeof quoteInputSchema>;

// MarkQuoteUsed input schema
export const markQuoteUsedInputSchema = z.object({
    quoteId: uuidSchema,
    usedByRef: z.string().min(1, "usedByRef is required").max(255),
    at: z.date(),
});

export type MarkQuoteUsedInput = z.infer<typeof markQuoteUsedInputSchema>;

// GetLatestRate input schema (for internal use)
export const getLatestRateInputSchema = z.object({
    base: currencySchema,
    quote: currencySchema,
    asOf: z.date(),
});

export type GetLatestRateInput = z.infer<typeof getLatestRateInputSchema>;

// Validation helper that throws ValidationError
import { ValidationError } from "./errors.js";

export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown, context?: string): T {
    const result = schema.safeParse(input);

    if (!result.success) {
        const errors = result.error.issues;
        if (!errors || errors.length === 0) {
            throw new ValidationError(`Validation failed${context ? ` for ${context}` : ''}: ${result.error.message || 'Unknown error'}`);
        }

        const firstError = errors[0]!;
        const path = firstError.path.join(".");
        const message = path ? `${path}: ${firstError.message}` : firstError.message;

        throw new ValidationError(`${context ? `${context}: ` : ''}${message}`);
    }

    return result.data;
}

// Convenience validators
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

export function validateGetLatestRateInput(input: unknown): GetLatestRateInput {
    return validateInput(getLatestRateInputSchema, input, "getLatestRate");
}
