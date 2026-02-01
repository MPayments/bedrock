import { z } from "zod";

// Shared schemas
const uuidSchema = z.string().uuid();

const currencySchema = z
    .string()
    .transform((val) => val.trim().toUpperCase())
    .refine((val) => /^[A-Z0-9_]{2,16}$/.test(val), {
        message: "Currency must be 2-16 uppercase alphanumeric characters or underscores",
    });

const positiveAmountSchema = z.bigint().positive({ message: "Amount must be positive" });
const nonNegativeAmountSchema = z.bigint().min(0n, { message: "Amount must be non-negative" });

const railRefSchema = z.string().min(1, "railRef is required").max(255);

// FundingSettled input schema
export const fundingSettledInputSchema = z.object({
    orderId: uuidSchema,
    branchOrgId: uuidSchema,
    branchBankStableKey: z.string().min(1, "branchBankStableKey is required"),
    customerId: uuidSchema,
    currency: currencySchema,
    amountMinor: positiveAmountSchema,
    railRef: railRefSchema,
    occurredAt: z.date(),
});

export type FundingSettledInput = z.infer<typeof fundingSettledInputSchema>;

// ExecuteFx input schema
export const executeFxInputSchema = z.object({
    orderId: uuidSchema,
    branchOrgId: uuidSchema,
    customerId: uuidSchema,
    payInCurrency: currencySchema,
    principalMinor: positiveAmountSchema,
    feeMinor: nonNegativeAmountSchema,
    spreadMinor: nonNegativeAmountSchema,
    payOutCurrency: currencySchema,
    payOutAmountMinor: positiveAmountSchema,
    occurredAt: z.date(),
    quoteRef: z.string().min(1, "quoteRef is required").max(255),
});

export type ExecuteFxInput = z.infer<typeof executeFxInputSchema>;

// InitiatePayout input schema
export const initiatePayoutInputSchema = z.object({
    orderId: uuidSchema,
    payoutOrgId: uuidSchema,
    payoutBankStableKey: z.string().min(1, "payoutBankStableKey is required"),
    payOutCurrency: currencySchema,
    amountMinor: positiveAmountSchema,
    railRef: railRefSchema,
    timeoutSeconds: z.number().int().positive({ message: "timeoutSeconds must be positive" }).optional(),
    occurredAt: z.date(),
});

export type InitiatePayoutInput = z.infer<typeof initiatePayoutInputSchema>;

// SettlePayout input schema
export const settlePayoutInputSchema = z.object({
    orderId: uuidSchema,
    payOutCurrency: currencySchema,
    railRef: railRefSchema,
    occurredAt: z.date(),
});

export type SettlePayoutInput = z.infer<typeof settlePayoutInputSchema>;

// VoidPayout input schema
export const voidPayoutInputSchema = z.object({
    orderId: uuidSchema,
    payOutCurrency: currencySchema,
    railRef: railRefSchema,
    occurredAt: z.date(),
});

export type VoidPayoutInput = z.infer<typeof voidPayoutInputSchema>;

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
export function validateFundingSettledInput(input: unknown): FundingSettledInput {
    return validateInput(fundingSettledInputSchema, input, "fundingSettled");
}

export function validateExecuteFxInput(input: unknown): ExecuteFxInput {
    return validateInput(executeFxInputSchema, input, "executeFx");
}

export function validateInitiatePayoutInput(input: unknown): InitiatePayoutInput {
    return validateInput(initiatePayoutInputSchema, input, "initiatePayout");
}

export function validateSettlePayoutInput(input: unknown): SettlePayoutInput {
    return validateInput(settlePayoutInputSchema, input, "settlePayout");
}

export function validateVoidPayoutInput(input: unknown): VoidPayoutInput {
    return validateInput(voidPayoutInputSchema, input, "voidPayout");
}
