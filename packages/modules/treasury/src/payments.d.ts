import { z } from "zod";
import type { AdjustmentComponent, FeeComponent } from "@bedrock/fees";
import type { DocumentModule } from "@bedrock/documents";
declare const PaymentCaseSchema: z.ZodObject<{
    customerId: z.ZodOptional<z.ZodUUID>;
    subject: z.ZodString;
    memo: z.ZodOptional<z.ZodString>;
    ref: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
declare const PayinFundingSchema: z.ZodObject<{
    caseDocumentId: z.ZodUUID;
    branchCounterpartyId: z.ZodUUID;
    branchBankStableKey: z.ZodString;
    customerId: z.ZodUUID;
    payInOperationalAccountId: z.ZodUUID;
    currency: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    amountMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
    railRef: z.ZodString;
    memo: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
declare const FxExecuteSchema: z.ZodObject<{
    caseDocumentId: z.ZodUUID;
    payinFundingDocumentId: z.ZodUUID;
    branchCounterpartyId: z.ZodUUID;
    customerId: z.ZodUUID;
    payOutCounterpartyId: z.ZodUUID;
    payOutOperationalAccountId: z.ZodUUID;
    dealDirection: z.ZodOptional<z.ZodEnum<{
        cash_to_usdt: "cash_to_usdt";
        cash_to_wire: "cash_to_wire";
        other: "other";
        usdt_to_cash: "usdt_to_cash";
        wire_to_cash: "wire_to_cash";
        wire_to_wire: "wire_to_wire";
    }>>;
    dealForm: z.ZodOptional<z.ZodEnum<{
        conversion: "conversion";
        transit: "transit";
    }>>;
    payInCurrency: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    principalMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
    fees: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodPipe<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        kind: z.ZodString;
        currency: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        amountMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
        settlementMode: z.ZodOptional<z.ZodEnum<{
            in_ledger: "in_ledger";
            separate_payment_order: "separate_payment_order";
        }>>;
        accountingTreatment: z.ZodOptional<z.ZodEnum<{
            expense: "expense";
            income: "income";
            pass_through: "pass_through";
        }>>;
        memo: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodTransform<{
        kind: string;
        currency: string;
        amountMinor: string;
        id: string;
        settlementMode: "in_ledger" | "separate_payment_order";
        accountingTreatment: "expense" | "income" | "pass_through";
        memo: string | null;
        metadata: Record<string, string> | null;
    }, {
        id?: string | undefined;
        kind: string;
        currency: string;
        amountMinor: string;
        settlementMode?: "in_ledger" | "separate_payment_order" | undefined;
        accountingTreatment?: "expense" | "income" | "pass_through" | undefined;
        memo?: string | undefined;
        metadata?: Record<string, string> | undefined;
    }>>>>>;
    adjustments: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodPipe<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        kind: z.ZodString;
        effect: z.ZodEnum<{
            decrease_charge: "decrease_charge";
            increase_charge: "increase_charge";
        }>;
        currency: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        amountMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
        settlementMode: z.ZodOptional<z.ZodEnum<{
            in_ledger: "in_ledger";
            separate_payment_order: "separate_payment_order";
        }>>;
        memo: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, z.core.$strip>, z.ZodTransform<{
        kind: string;
        effect: "decrease_charge" | "increase_charge";
        currency: string;
        amountMinor: string;
        id: string;
        settlementMode: "in_ledger" | "separate_payment_order";
        memo: string | null;
        metadata: Record<string, string> | null;
    }, {
        id?: string | undefined;
        kind: string;
        effect: "decrease_charge" | "increase_charge";
        currency: string;
        amountMinor: string;
        settlementMode?: "in_ledger" | "separate_payment_order" | undefined;
        memo?: string | undefined;
        metadata?: Record<string, string> | undefined;
    }>>>>>;
    payOutCurrency: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    payOutAmountMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
    quoteRef: z.ZodString;
    memo: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
declare const PayoutInitiateSchema: z.ZodObject<{
    caseDocumentId: z.ZodUUID;
    fxExecuteDocumentId: z.ZodUUID;
    payoutCounterpartyId: z.ZodUUID;
    payoutBankStableKey: z.ZodString;
    payoutOperationalAccountId: z.ZodUUID;
    payOutCurrency: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    amountMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
    railRef: z.ZodString;
    timeoutSeconds: z.ZodOptional<z.ZodNumber>;
    memo: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
declare const FeePayoutInitiateSchema: z.ZodObject<{
    caseDocumentId: z.ZodUUID;
    fxExecuteDocumentId: z.ZodUUID;
    componentId: z.ZodString;
    feeBucket: z.ZodString;
    accountingTreatment: z.ZodEnum<{
        expense: "expense";
        income: "income";
        pass_through: "pass_through";
    }>;
    currency: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    amountMinor: z.ZodPipe<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBigInt]>, z.ZodTransform<string, string | number | bigint>>;
    payoutCounterpartyId: z.ZodUUID;
    payoutOperationalAccountId: z.ZodUUID;
    railRef: z.ZodString;
    timeoutSeconds: z.ZodOptional<z.ZodNumber>;
    memo: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodCoercedDate<unknown>;
}, z.core.$strip>;
type PaymentCasePayload = z.infer<typeof PaymentCaseSchema>;
type PayinFundingPayload = z.infer<typeof PayinFundingSchema>;
type FxExecutePayload = z.infer<typeof FxExecuteSchema>;
type PayoutInitiatePayload = z.infer<typeof PayoutInitiateSchema>;
type FeePayoutInitiatePayload = z.infer<typeof FeePayoutInitiateSchema>;
interface PaymentFeesService {
    getComponentDefaults: (kind: string) => {
        bucket: string;
        transferCode: number;
        memo: string;
    };
    getQuoteFeeComponents: (input: {
        quoteId: string;
    }, tx?: unknown) => Promise<FeeComponent[]>;
    mergeFeeComponents: (input: {
        computed?: FeeComponent[];
        manual?: FeeComponent[];
        aggregate?: boolean;
    }) => FeeComponent[];
    mergeAdjustmentComponents: (input: {
        computed?: AdjustmentComponent[];
        manual?: AdjustmentComponent[];
        aggregate?: boolean;
    }) => AdjustmentComponent[];
    partitionAdjustmentComponents: (components: AdjustmentComponent[]) => {
        inLedger: AdjustmentComponent[];
        separatePaymentOrder: AdjustmentComponent[];
    };
}
export declare function createPaymentCaseDocumentModule(): DocumentModule<PaymentCasePayload, PaymentCasePayload>;
export declare function createPayinFundingDocumentModule(deps: {
    currenciesService: {
        findById: (id: string) => Promise<{
            code: string;
        }>;
    };
}): DocumentModule<PayinFundingPayload, PayinFundingPayload>;
export declare function createFxExecuteDocumentModule(deps: {
    feesService: PaymentFeesService;
    currenciesService: {
        findById: (id: string) => Promise<{
            code: string;
        }>;
    };
}): DocumentModule<FxExecutePayload, FxExecutePayload>;
export declare function createPayoutInitiateDocumentModule(deps: {
    currenciesService: {
        findById: (id: string) => Promise<{
            code: string;
        }>;
    };
}): DocumentModule<PayoutInitiatePayload, PayoutInitiatePayload>;
export declare function createPayoutSettleDocumentModule(): DocumentModule<{
    payoutInitiateDocumentId: string;
    payOutCurrency: string;
    railRef: string;
    memo?: string | undefined;
    occurredAt: Date;
}, {
    payoutInitiateDocumentId: string;
    payOutCurrency: string;
    railRef: string;
    memo?: string | undefined;
    occurredAt: Date;
}>;
export declare function createPayoutVoidDocumentModule(): DocumentModule<{
    payoutInitiateDocumentId: string;
    payOutCurrency: string;
    railRef: string;
    memo?: string | undefined;
    occurredAt: Date;
}, {
    payoutInitiateDocumentId: string;
    payOutCurrency: string;
    railRef: string;
    memo?: string | undefined;
    occurredAt: Date;
}>;
export declare function createFeePayoutInitiateDocumentModule(deps: {
    currenciesService: {
        findById: (id: string) => Promise<{
            code: string;
        }>;
    };
    feesService: PaymentFeesService;
}): DocumentModule<FeePayoutInitiatePayload, FeePayoutInitiatePayload>;
export declare function createFeePayoutSettleDocumentModule(): DocumentModule<{
    feePayoutInitiateDocumentId: string;
    railRef: string;
    memo?: string | undefined;
    occurredAt: Date;
}, {
    feePayoutInitiateDocumentId: string;
    railRef: string;
    memo?: string | undefined;
    occurredAt: Date;
}>;
export declare function createFeePayoutVoidDocumentModule(): DocumentModule<{
    feePayoutInitiateDocumentId: string;
    railRef: string;
    memo?: string | undefined;
    occurredAt: Date;
}, {
    feePayoutInitiateDocumentId: string;
    railRef: string;
    memo?: string | undefined;
    occurredAt: Date;
}>;
export {};
//# sourceMappingURL=payments.d.ts.map