import { defineKeyspace } from "@repo/ledger";

export const treasuryKeyspace = defineKeyspace("treasury", {
    customerWallet: (customerId: string, currency: string) => `CustomerWallet:${customerId}:${currency}`,

    bank: (orgId: string, bankStableKey: string, currency: string) => `Bank:${orgId}:${bankStableKey}:${currency}`,

    treasuryPool: (treasuryOrgId: string, currency: string) => `TreasuryPool:${treasuryOrgId}:${currency}`,

    intercompanyNet: (treasuryOrgId: string, branchOrgId: string, currency: string) =>
        `IC:BranchNet:${treasuryOrgId}<->${branchOrgId}:${currency}`,

    orderPayIn: (orderId: string, currency: string) => `OrderPayIn:${orderId}:${currency}`,

    payoutObligation: (orderId: string, currency: string) => `PayoutObligation:${orderId}:${currency}`,

    revenueFee: (treasuryOrgId: string, currency: string) => `Revenue:Fee:${treasuryOrgId}:${currency}`,

    revenueSpread: (treasuryOrgId: string, currency: string) => `Revenue:FXSpread:${treasuryOrgId}:${currency}`
});
