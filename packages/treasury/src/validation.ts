import { z } from "zod";
import { normalizeCurrency, isValidCurrency } from "@bedrock/kernel";
import {
    adjustmentEffectSchema,
    feeDealDirectionSchema,
    feeDealFormSchema,
    feeSettlementModeSchema,
} from "@bedrock/fees";

const uuidSchema = z.string().uuid();

const currencySchema = z
    .string()
    .refine((val) => isValidCurrency(val), {
        message: "Currency must be 2-16 uppercase alphanumeric characters or underscores",
    })
    .transform((val) => normalizeCurrency(val));

const positiveAmountSchema = z.bigint().positive({ message: "Amount must be positive" });
const nonNegativeAmountSchema = z.bigint().min(0n, { message: "Amount must be non-negative" });
const railRefSchema = z.string().min(1, "railRef is required").max(255);

const feeComponentInputSchema = z
    .object({
        id: z.string().min(1).max(128).optional(),
        kind: z.string().min(1).max(64),
        currency: currencySchema,
        amountMinor: nonNegativeAmountSchema,
        settlementMode: feeSettlementModeSchema.optional(),
        debitAccountKey: z.string().min(1).optional(),
        creditAccountKey: z.string().min(1).optional(),
        transferCode: z.number().int().min(0).optional(),
        memo: z.string().max(1000).optional(),
        metadata: z.record(z.string(), z.string().max(255)).optional(),
    })
    .refine((data) => Boolean(data.debitAccountKey) === Boolean(data.creditAccountKey), {
        message: "debitAccountKey and creditAccountKey must be provided together",
        path: ["debitAccountKey"],
    })
    .transform((data) => ({
        ...data,
        id: data.id ?? `manual:${data.kind}:${data.currency}:${data.amountMinor.toString()}`,
        source: "manual" as const,
        settlementMode: data.settlementMode ?? "in_ledger",
    }));

const adjustmentInputSchema = z
    .object({
        id: z.string().min(1).max(128).optional(),
        kind: z.string().min(1).max(64),
        effect: adjustmentEffectSchema,
        currency: currencySchema,
        amountMinor: positiveAmountSchema,
        settlementMode: feeSettlementModeSchema.optional(),
        debitAccountKey: z.string().min(1).optional(),
        creditAccountKey: z.string().min(1).optional(),
        transferCode: z.number().int().min(0).optional(),
        memo: z.string().max(1000).optional(),
        metadata: z.record(z.string(), z.string().max(255)).optional(),
    })
    .refine((data) => Boolean(data.debitAccountKey) === Boolean(data.creditAccountKey), {
        message: "debitAccountKey and creditAccountKey must be provided together",
        path: ["debitAccountKey"],
    })
    .transform((data) => ({
        ...data,
        id: data.id ?? `adjustment:${data.kind}:${data.effect}:${data.currency}:${data.amountMinor.toString()}`,
        source: "manual" as const,
        settlementMode: data.settlementMode ?? "in_ledger",
    }));

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

export const executeFxInputSchema = z.object({
    orderId: uuidSchema,
    branchOrgId: uuidSchema,
    customerId: uuidSchema,
    dealDirection: feeDealDirectionSchema.optional(),
    dealForm: feeDealFormSchema.optional(),
    payInCurrency: currencySchema,
    principalMinor: positiveAmountSchema,
    fees: z.array(feeComponentInputSchema).optional().default([]),
    adjustments: z.array(adjustmentInputSchema).optional().default([]),
    payOutCurrency: currencySchema,
    payOutAmountMinor: positiveAmountSchema,
    occurredAt: z.date(),
    quoteRef: z.string().min(1, "quoteRef is required").max(255),
});

// Public request type: allows omitted defaults and pre-transform fee/adjustment fields.
export type ExecuteFxInput = z.input<typeof executeFxInputSchema>;
// Internal validated shape after defaults/transforms are applied.
export type ExecuteFxValidatedInput = z.output<typeof executeFxInputSchema>;
export type ExecuteFxFeeInput = z.input<typeof feeComponentInputSchema>;
export type ExecuteFxFeeComponent = z.output<typeof feeComponentInputSchema>;
export type ExecuteFxAdjustmentInput = z.input<typeof adjustmentInputSchema>;
export type ExecuteFxAdjustmentComponent = z.output<typeof adjustmentInputSchema>;

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

export const settlePayoutInputSchema = z.object({
    orderId: uuidSchema,
    payOutCurrency: currencySchema,
    railRef: railRefSchema,
    occurredAt: z.date(),
});

export type SettlePayoutInput = z.infer<typeof settlePayoutInputSchema>;

export const voidPayoutInputSchema = z.object({
    orderId: uuidSchema,
    payOutCurrency: currencySchema,
    railRef: railRefSchema,
    occurredAt: z.date(),
});

export type VoidPayoutInput = z.infer<typeof voidPayoutInputSchema>;

export const initiateFeePaymentInputSchema = z.object({
    feePaymentOrderId: uuidSchema,
    payoutOrgId: uuidSchema,
    payoutBankStableKey: z.string().min(1),
    railRef: railRefSchema,
    timeoutSeconds: z.number().int().positive().optional(),
    occurredAt: z.date(),
});

export type InitiateFeePaymentInput = z.infer<typeof initiateFeePaymentInputSchema>;

export const settleFeePaymentInputSchema = z.object({
    feePaymentOrderId: uuidSchema,
    railRef: railRefSchema,
    occurredAt: z.date(),
});

export type SettleFeePaymentInput = z.infer<typeof settleFeePaymentInputSchema>;

export const voidFeePaymentInputSchema = z.object({
    feePaymentOrderId: uuidSchema,
    railRef: railRefSchema,
    occurredAt: z.date(),
});

export type VoidFeePaymentInput = z.infer<typeof voidFeePaymentInputSchema>;

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

export function validateFundingSettledInput(input: unknown): FundingSettledInput {
    return validateInput(fundingSettledInputSchema, input, "fundingSettled");
}

export function validateExecuteFxInput(input: unknown): ExecuteFxValidatedInput {
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

export function validateInitiateFeePaymentInput(input: unknown): InitiateFeePaymentInput {
    return validateInput(initiateFeePaymentInputSchema, input, "initiateFeePayment");
}

export function validateSettleFeePaymentInput(input: unknown): SettleFeePaymentInput {
    return validateInput(settleFeePaymentInputSchema, input, "settleFeePayment");
}

export function validateVoidFeePaymentInput(input: unknown): VoidFeePaymentInput {
    return validateInput(voidFeePaymentInputSchema, input, "voidFeePayment");
}
