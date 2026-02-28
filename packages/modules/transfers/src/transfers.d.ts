import { z } from "zod";
import type { DocumentModule } from "@bedrock/documents";
declare const TransferCreateSchema: z.ZodObject<{
    sourceOperationalAccountId: z.ZodUUID;
    destinationOperationalAccountId: z.ZodUUID;
    amountMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
    memo: z.ZodOptional<z.ZodString>;
    settlementMode: z.ZodDefault<z.ZodEnum<{
        immediate: "immediate";
        pending: "pending";
    }>>;
    timeoutSeconds: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    occurredAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
export declare function createTransferDocumentModule(deps: {
    operationalAccountsService: {
        resolveTransferBindings: (input: {
            accountIds: string[];
        }) => Promise<{
            accountId: string;
            counterpartyId: string;
            currencyId: string;
            currencyCode: string;
            stableKey: string;
        }[]>;
    };
}): DocumentModule<z.infer<typeof TransferCreateSchema>, z.infer<typeof TransferCreateSchema>>;
export declare function createTransferSettleDocumentModule(): DocumentModule<{
    transferDocumentId: string;
    eventIdempotencyKey: string;
    externalRef?: string | undefined;
    occurredAt: Date;
}, {
    transferDocumentId: string;
    eventIdempotencyKey: string;
    externalRef?: string | undefined;
    occurredAt: Date;
}>;
export declare function createTransferVoidDocumentModule(): DocumentModule<{
    transferDocumentId: string;
    eventIdempotencyKey: string;
    externalRef?: string | undefined;
    occurredAt: Date;
}, {
    transferDocumentId: string;
    eventIdempotencyKey: string;
    externalRef?: string | undefined;
    occurredAt: Date;
}>;
export {};
//# sourceMappingURL=transfers.d.ts.map