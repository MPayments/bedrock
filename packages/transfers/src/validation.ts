import { z } from "zod";

import { normalizeCurrency, isValidCurrency } from "@bedrock/kernel";

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

const accountKeySchema = z.string().min(1, "accountKey is required");

const memoSchema = z.string().max(1000, "memo cannot exceed 1000 characters").optional();

const reasonSchema = z.string().min(1, "reason is required").max(1000, "reason cannot exceed 1000 characters");

// CreateDraft input schema
export const createDraftInputSchema = z.object({
    orgId: uuidSchema,
    idempotencyKey: idempotencyKeySchema,
    fromAccountKey: accountKeySchema,
    toAccountKey: accountKeySchema,
    currency: currencySchema,
    amountMinor: positiveAmountSchema,
    memo: memoSchema,
    makerUserId: uuidSchema,
}).refine(
    (data) => data.fromAccountKey !== data.toAccountKey,
    { message: "fromAccountKey and toAccountKey must be different (cannot transfer to self)" }
);

export type CreateDraftInput = z.infer<typeof createDraftInputSchema>;

// Approve input schema
export const approveInputSchema = z.object({
    orgId: uuidSchema,
    transferId: uuidSchema,
    checkerUserId: uuidSchema,
    occurredAt: z.date(),
});

export type ApproveInput = z.infer<typeof approveInputSchema>;

// Reject input schema
export const rejectInputSchema = z.object({
    orgId: uuidSchema,
    transferId: uuidSchema,
    checkerUserId: uuidSchema,
    occurredAt: z.date(),
    reason: reasonSchema,
});

export type RejectInput = z.infer<typeof rejectInputSchema>;

// MarkFailed input schema
export const markFailedInputSchema = z.object({
    orgId: uuidSchema,
    transferId: uuidSchema,
    reason: reasonSchema,
});

export type MarkFailedInput = z.infer<typeof markFailedInputSchema>;

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
export function validateCreateDraftInput(input: unknown): CreateDraftInput {
    return validateInput(createDraftInputSchema, input, "createDraft");
}

export function validateApproveInput(input: unknown): ApproveInput {
    return validateInput(approveInputSchema, input, "approve");
}

export function validateRejectInput(input: unknown): RejectInput {
    return validateInput(rejectInputSchema, input, "reject");
}

export function validateMarkFailedInput(input: unknown): MarkFailedInput {
    return validateInput(markFailedInputSchema, input, "markFailed");
}
