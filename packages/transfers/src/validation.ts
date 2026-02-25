import { z } from "zod";

import {
    createListQuerySchemaFromContract,
    type ListQueryContract,
} from "@bedrock/kernel/pagination";

import { ValidationError } from "./errors.js";

const uuidSchema = z.uuid({
    version: "v4",
});

const positiveAmountSchema = z.bigint().positive({ message: "amountMinor must be positive" });
const idempotencyKeySchema = z.string().min(1, "idempotencyKey is required").max(255);
const eventIdempotencyKeySchema = z.string().min(1, "eventIdempotencyKey is required").max(255);
const memoSchema = z.string().max(1000, "memo cannot exceed 1000 characters").optional();
const reasonSchema = z.string().min(1, "reason is required").max(1000, "reason cannot exceed 1000 characters");

export const TransferKindSchema = z.enum([
    "intra_org",
    "cross_org",
]);

export const TransferSettlementModeSchema = z.enum([
    "immediate",
    "pending",
]);

export const TransferStatusSchema = z.enum([
    "draft",
    "approved_pending_posting",
    "pending",
    "settle_pending_posting",
    "void_pending_posting",
    "posted",
    "voided",
    "rejected",
    "failed",
]);

export const CreateTransferDraftInputSchema = z.object({
    sourceAccountId: uuidSchema,
    destinationAccountId: uuidSchema,
    idempotencyKey: idempotencyKeySchema,
    amountMinor: positiveAmountSchema,
    memo: memoSchema,
    makerUserId: uuidSchema,
    settlementMode: TransferSettlementModeSchema.default("immediate"),
    timeoutSeconds: z.coerce.number().int().positive().max(7 * 24 * 60 * 60).optional(),
}).refine(
    (data) => data.sourceAccountId !== data.destinationAccountId,
    { message: "sourceAccountId and destinationAccountId must be different" },
);
export type CreateTransferDraftInput = z.infer<typeof CreateTransferDraftInputSchema>;

export const ApproveTransferInputSchema = z.object({
    transferId: uuidSchema,
    checkerUserId: uuidSchema,
    occurredAt: z.date(),
});
export type ApproveTransferInput = z.infer<typeof ApproveTransferInputSchema>;

export const RejectTransferInputSchema = z.object({
    transferId: uuidSchema,
    checkerUserId: uuidSchema,
    occurredAt: z.date(),
    reason: reasonSchema,
});
export type RejectTransferInput = z.infer<typeof RejectTransferInputSchema>;

const settleVoidBaseSchema = z.object({
    transferId: uuidSchema,
    eventIdempotencyKey: eventIdempotencyKeySchema,
    occurredAt: z.date(),
    externalRef: z.string().max(255).optional(),
});

export const SettlePendingTransferInputSchema = settleVoidBaseSchema;
export type SettlePendingTransferInput = z.infer<typeof SettlePendingTransferInputSchema>;

export const VoidPendingTransferInputSchema = settleVoidBaseSchema.extend({
    reason: reasonSchema.optional(),
});
export type VoidPendingTransferInput = z.infer<typeof VoidPendingTransferInputSchema>;

const TRANSFERS_SORTABLE_COLUMNS = ["createdAt", "updatedAt", "approvedAt"] as const;

interface TransfersListFilters {
    sourceCounterpartyId: { kind: "string"; cardinality: "single" };
    destinationCounterpartyId: { kind: "string"; cardinality: "single" };
    status: { kind: "string"; cardinality: "multi"; enumValues: readonly [
        "draft",
        "approved_pending_posting",
        "pending",
        "settle_pending_posting",
        "void_pending_posting",
        "posted",
        "voided",
        "rejected",
        "failed"
    ] };
    settlementMode: { kind: "string"; cardinality: "multi"; enumValues: readonly ["immediate", "pending"] };
    kind: { kind: "string"; cardinality: "multi"; enumValues: readonly ["intra_org", "cross_org"] };
}

export const TRANSFERS_LIST_CONTRACT: ListQueryContract<
    typeof TRANSFERS_SORTABLE_COLUMNS,
    TransfersListFilters
> = {
    sortableColumns: TRANSFERS_SORTABLE_COLUMNS,
    defaultSort: { id: "createdAt", desc: true },
    filters: {
        sourceCounterpartyId: { kind: "string", cardinality: "single" },
        destinationCounterpartyId: { kind: "string", cardinality: "single" },
        status: {
            kind: "string",
            cardinality: "multi",
            enumValues: [
                "draft",
                "approved_pending_posting",
                "pending",
                "settle_pending_posting",
                "void_pending_posting",
                "posted",
                "voided",
                "rejected",
                "failed",
            ],
        },
        settlementMode: {
            kind: "string",
            cardinality: "multi",
            enumValues: ["immediate", "pending"],
        },
        kind: {
            kind: "string",
            cardinality: "multi",
            enumValues: ["intra_org", "cross_org"],
        },
    },
};

export const ListTransfersQuerySchema = createListQuerySchemaFromContract(
    TRANSFERS_LIST_CONTRACT,
);
export type ListTransfersQuery = z.infer<typeof ListTransfersQuerySchema>;

export function validateInput<T>(schema: z.ZodSchema<T>, input: unknown, context?: string): T {
    const result = schema.safeParse(input);

    if (!result.success) {
        const errors = result.error.issues;
        if (!errors || errors.length === 0) {
            throw new ValidationError(
                `Validation failed${context ? ` for ${context}` : ""}: ${result.error.message || "Unknown error"}`,
            );
        }

        const firstError = errors[0]!;
        const path = firstError.path.join(".");
        const message = path ? `${path}: ${firstError.message}` : firstError.message;

        throw new ValidationError(`${context ? `${context}: ` : ""}${message}`);
    }

    return result.data;
}

export function validateCreateTransferDraftInput(input: unknown): CreateTransferDraftInput {
    return validateInput(CreateTransferDraftInputSchema, input, "createDraft");
}

export function validateApproveTransferInput(input: unknown): ApproveTransferInput {
    return validateInput(ApproveTransferInputSchema, input, "approve");
}

export function validateRejectTransferInput(input: unknown): RejectTransferInput {
    return validateInput(RejectTransferInputSchema, input, "reject");
}

export function validateSettlePendingTransferInput(input: unknown): SettlePendingTransferInput {
    return validateInput(SettlePendingTransferInputSchema, input, "settlePending");
}

export function validateVoidPendingTransferInput(input: unknown): VoidPendingTransferInput {
    return validateInput(VoidPendingTransferInputSchema, input, "voidPending");
}
