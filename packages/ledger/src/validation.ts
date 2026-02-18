import { z } from "zod";

import { PlanType } from "./types";

const uuidSchema = z.uuid({
    version: "v4",
});

export const orgIdSchema = uuidSchema;
export const idempotencyKeySchema = z.string().min(1).max(255);
export const sourceTypeSchema = z.string().min(1).max(100);
export const sourceIdSchema = z.string().min(1).max(255);
export const memoSchema = z.string().max(1000).optional().nullable();

export const currencySchema = z
    .string()
    .transform((val) => val.trim().toUpperCase())
    .refine((val) => /^[A-Z0-9_]{2,16}$/.test(val), {
        message: "Currency must be 2-16 uppercase alphanumeric characters or underscores",
    });

export const planKeySchema = z.string().min(1).max(512);
export const accountKeySchema = z.string().min(1);
export const positiveAmountSchema = z.bigint().positive();
export const nonNegativeAmountSchema = z.bigint().min(0n);
export const positiveTimeoutSchema = z.number().int().positive();
export const transferCodeSchema = z.number().int().min(0).optional();
export const chainIdSchema = z.string().min(1).optional().nullable();

export const pendingConfigSchema = z
    .object({
        timeoutSeconds: positiveTimeoutSchema,
    })
    .optional();

const baseTransferPlanSchema = z.object({
    planKey: planKeySchema,
    currency: currencySchema,
    code: transferCodeSchema,
    chain: chainIdSchema,
    memo: memoSchema,
});

export const createTransferPlanSchema = baseTransferPlanSchema.extend({
    type: z.literal(PlanType.CREATE),
    debitKey: accountKeySchema,
    creditKey: accountKeySchema,
    amount: positiveAmountSchema,
    pending: pendingConfigSchema,
}).refine(
    (data) => data.debitKey !== data.creditKey,
    { message: "debitKey and creditKey must be different (cannot transfer to self)" }
);

export const postPendingTransferPlanSchema = baseTransferPlanSchema.extend({
    type: z.literal(PlanType.POST_PENDING),
    pendingId: z.bigint().positive(),
    amount: nonNegativeAmountSchema.optional(),
});

export const voidPendingTransferPlanSchema = baseTransferPlanSchema.extend({
    type: z.literal(PlanType.VOID_PENDING),
    pendingId: z.bigint().positive(),
});

export const transferPlanSchema = z.discriminatedUnion("type", [
    createTransferPlanSchema,
    postPendingTransferPlanSchema,
    voidPendingTransferPlanSchema,
]);

export const sourceSchema = z.object({
    type: sourceTypeSchema,
    id: sourceIdSchema,
});

export const createEntryInputSchema = z.object({
    orgId: orgIdSchema,
    source: sourceSchema,
    idempotencyKey: idempotencyKeySchema,
    postingDate: z.date(),
    transfers: z.array(transferPlanSchema).min(1, "transfers must be a non-empty array"),
});

export type ValidatedCreateEntryInput = z.infer<typeof createEntryInputSchema>;
export type ValidatedTransferPlan = z.infer<typeof transferPlanSchema>;

export function validateCreateEntryInput(input: unknown): ValidatedCreateEntryInput {
    const result = createEntryInputSchema.safeParse(input);

    if (!result.success) {
        const errors = result.error.issues;
        if (!errors || errors.length === 0) {
            throw new Error(`Validation failed: ${result.error.message || 'Unknown validation error'}`);
        }

        const firstError = errors[0]!;
        const path = firstError.path.join(".");

        if (path === "orgId") {
            throw new Error(`orgId must be a valid UUID, got: "${(input as any)?.orgId}"`);
        }
        if (path === "transfers" || firstError.message?.includes("at least 1")) {
            throw new Error("transfers must be a non-empty array");
        }
        if (path.includes("currency")) {
            throw new Error(`Invalid currency format: "${(input as any)?.transfers?.[0]?.currency}"`);
        }
        if (path.includes("debitKey") || path.includes("creditKey")) {
            throw new Error("create transfer requires debitKey and creditKey");
        }
        if (path.includes("amount")) {
            const transferType = (input as any)?.transfers?.[0]?.type;
            if (transferType === PlanType.CREATE) {
                throw new Error("create transfer amount must be > 0");
            }
            if (transferType === PlanType.POST_PENDING) {
                throw new Error("post_pending amount must be >= 0");
            }
        }
        if (path.includes("timeoutSeconds")) {
            throw new Error("pending timeoutSeconds must be > 0");
        }
        if (path.includes("pendingId")) {
            const transferType = (input as any)?.transfers?.[0]?.type;
            if (transferType === PlanType.POST_PENDING) {
                throw new Error("post_pending pendingId must be set");
            }
            if (transferType === PlanType.VOID_PENDING) {
                throw new Error("void_pending pendingId must be set");
            }
        }
        if (path.includes("planKey")) {
            throw new Error("Invalid planKey (missing/too long)");
        }

        throw new Error(`${path}: ${firstError.message}`);
    }

    return result.data;
}

export function validateChainBlocks(transfers: ValidatedTransferPlan[]): void {
    const pos = new Map<string, number[]>();

    for (let i = 0; i < transfers.length; i++) {
        const ch = transfers[i]!.chain;
        if (!ch) continue;

        const arr = pos.get(ch) ?? [];
        arr.push(i);
        pos.set(ch, arr);
    }

    for (const [ch, arr] of pos) {
        for (let i = 1; i < arr.length; i++) {
            if (arr[i]! !== arr[i - 1]! + 1) {
                throw new Error(
                    `Non-contiguous chain block detected for chain="${ch}". ` +
                        `Chain entries must be adjacent in transfers[] to be safe with TB linked semantics.`
                );
            }
        }
    }
}
