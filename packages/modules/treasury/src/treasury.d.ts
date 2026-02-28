import { z } from "zod";
import type { DocumentModule } from "@bedrock/documents";
declare const ExternalFundingPayloadSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        founder_equity: "founder_equity";
        investor_equity: "investor_equity";
        opening_balance: "opening_balance";
        shareholder_loan: "shareholder_loan";
    }>;
    operationalAccountId: z.ZodUUID;
    currency: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    amountMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
    entryRef: z.ZodString;
    occurredAt: z.ZodCoercedDate<unknown>;
    memo: z.ZodOptional<z.ZodString>;
    counterpartyId: z.ZodOptional<z.ZodUUID>;
    customerId: z.ZodOptional<z.ZodUUID>;
}, z.core.$strip>;
type ExternalFundingPayload = z.infer<typeof ExternalFundingPayloadSchema>;
export declare function createExternalFundingDocumentModule(deps: {
    currenciesService: {
        findById: (id: string) => Promise<{
            code: string;
        }>;
    };
}): DocumentModule<ExternalFundingPayload, ExternalFundingPayload>;
export {};
//# sourceMappingURL=treasury.d.ts.map