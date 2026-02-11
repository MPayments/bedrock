export const TreasuryOrderStatus = {
    QUOTE: "quote",
    FUNDING_PENDING: "funding_pending",
    FUNDING_SETTLED_PENDING_POSTING: "funding_settled_pending_posting",
    FUNDING_SETTLED: "funding_settled",
    FX_EXECUTED_PENDING_POSTING: "fx_executed_pending_posting",
    FX_EXECUTED: "fx_executed",
    PAYOUT_INITIATED_PENDING_POSTING: "payout_initiated_pending_posting",
    PAYOUT_INITIATED: "payout_initiated",
    CLOSED_PENDING_POSTING: "closed_pending_posting",
    CLOSED: "closed",
    FAILED_PENDING_POSTING: "failed_pending_posting",
    FAILED: "failed",
} as const;

export type TreasuryOrderStatusValue = (typeof TreasuryOrderStatus)[keyof typeof TreasuryOrderStatus];

export const FundingSettledAllowedFrom = [
    TreasuryOrderStatus.QUOTE,
    TreasuryOrderStatus.FUNDING_PENDING,
] as const;

export const ExecuteFxAllowedFrom = [TreasuryOrderStatus.FUNDING_SETTLED] as const;
export const InitiatePayoutAllowedFrom = [TreasuryOrderStatus.FX_EXECUTED] as const;
export const ResolvePendingPayoutAllowedFrom = [TreasuryOrderStatus.PAYOUT_INITIATED] as const;

export const AdvancedOrderStatuses = [
    TreasuryOrderStatus.FUNDING_SETTLED,
    TreasuryOrderStatus.FUNDING_SETTLED_PENDING_POSTING,
    TreasuryOrderStatus.FX_EXECUTED,
    TreasuryOrderStatus.FX_EXECUTED_PENDING_POSTING,
    TreasuryOrderStatus.PAYOUT_INITIATED,
    TreasuryOrderStatus.PAYOUT_INITIATED_PENDING_POSTING,
    TreasuryOrderStatus.CLOSED,
    TreasuryOrderStatus.CLOSED_PENDING_POSTING,
    TreasuryOrderStatus.FAILED,
    TreasuryOrderStatus.FAILED_PENDING_POSTING,
] as const;

export const OrderFinalizeFromPendingPosting: Readonly<Record<string, TreasuryOrderStatusValue>> = {
    [TreasuryOrderStatus.FUNDING_SETTLED_PENDING_POSTING]: TreasuryOrderStatus.FUNDING_SETTLED,
    [TreasuryOrderStatus.FX_EXECUTED_PENDING_POSTING]: TreasuryOrderStatus.FX_EXECUTED,
    [TreasuryOrderStatus.PAYOUT_INITIATED_PENDING_POSTING]: TreasuryOrderStatus.PAYOUT_INITIATED,
    [TreasuryOrderStatus.CLOSED_PENDING_POSTING]: TreasuryOrderStatus.CLOSED,
    [TreasuryOrderStatus.FAILED_PENDING_POSTING]: TreasuryOrderStatus.FAILED,
};

export function isOrderStatusIn(
    status: string,
    allowed: readonly TreasuryOrderStatusValue[]
): status is TreasuryOrderStatusValue {
    return (allowed as readonly string[]).includes(status);
}

export function isSameEntryInAllowedState(
    status: string,
    currentEntryId: string | null | undefined,
    expectedEntryId: string,
    allowedStatuses: readonly TreasuryOrderStatusValue[]
): boolean {
    return currentEntryId === expectedEntryId && isOrderStatusIn(status, allowedStatuses);
}
