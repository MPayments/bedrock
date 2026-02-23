import { defineKeyspace } from "@bedrock/ledger";

export type TreasuryKeyspace = typeof treasuryKeyspace;

export const treasuryKeyspace = defineKeyspace("treasury", {
    customerWallet: (customerId: string, currency: string) => `CustomerWallet:${customerId}:${currency}`,

    bank: (orgId: string, bankStableKey: string, currency: string) => `Bank:${orgId}:${bankStableKey}:${currency}`,

    intercompanyNet: (branchCounterpartyId: string, currency: string) =>
        `IC:BranchNet:${branchCounterpartyId}:${currency}`,

    orderInventory: (orderId: string, currency: string) => `OrderInventory:${orderId}:${currency}`,

    payoutObligation: (orderId: string, currency: string) => `PayoutObligation:${orderId}:${currency}`,

    revenueFee: (currency: string) => `Revenue:Fee:${currency}`,

    revenueSpread: (currency: string) => `Revenue:FXSpread:${currency}`,

    feeRevenueBucket: (bucket: string, currency: string) =>
        `Revenue:Fee:${bucket}:${currency}`,

    feeClearing: (bucket: string, currency: string) =>
        `Liability:FeeClearing:${bucket}:${currency}`,

    adjustmentRevenue: (bucket: string, currency: string) =>
        `Revenue:Adjustment:${bucket}:${currency}`,

    adjustmentExpense: (bucket: string, currency: string) =>
        `Expense:Adjustment:${bucket}:${currency}`
});
