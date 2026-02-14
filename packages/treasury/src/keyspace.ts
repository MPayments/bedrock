import { defineKeyspace } from "@bedrock/ledger";

export type TreasuryKeyspace = typeof treasuryKeyspace;

export const treasuryKeyspace = defineKeyspace("treasury", {
    customerWallet: (customerId: string, currency: string) => `CustomerWallet:${customerId}:${currency}`,

    bank: (orgId: string, bankStableKey: string, currency: string) => `Bank:${orgId}:${bankStableKey}:${currency}`,

    treasuryPool: (currency: string) => `TreasuryPool:${currency}`,

    intercompanyNet: (branchOrgId: string, currency: string) =>
        `IC:BranchNet:${branchOrgId}:${currency}`,

    orderPayIn: (orderId: string, currency: string) => `OrderPayIn:${orderId}:${currency}`,

    payoutObligation: (orderId: string, currency: string) => `PayoutObligation:${orderId}:${currency}`,

    revenueFee: (currency: string) => `Revenue:Fee:${currency}`,

    revenueSpread: (currency: string) => `Revenue:FXSpread:${currency}`,

    feeRevenueBucket: (bucket: string, currency: string) =>
        `Revenue:Fee:${bucket}:${currency}`,

    feeClearing: (bucket: string, currency: string) =>
        `Liability:FeeClearing:${bucket}:${currency}`
});
