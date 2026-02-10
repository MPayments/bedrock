/**
 * Treasury ledger transfer codes.
 * 
 * Code ranges:
 * - 1xxx: Funding operations
 * - 2xxx: FX execution operations
 * - 3xxx: Payout operations
 * - 4xxx: Internal transfer operations
 */

export const TransferCodes = {
    /** Customer funding received and settled to their wallet */
    FUNDING_SETTLED: 1001,

    /** FX principal moved from customer wallet to order pay-in account */
    FX_PRINCIPAL: 2001,

    /** Fee charged to customer, credited to revenue */
    FX_FEE_REVENUE: 2002,

    /** FX spread revenue captured */
    FX_SPREAD_REVENUE: 2003,

    /** Pay-in committed to intercompany net position */
    FX_INTERCOMPANY_COMMIT: 2004,

    /** Payout obligation created in destination currency */
    FX_PAYOUT_OBLIGATION: 2005,

    /** Payout initiated from treasury pool (pending until settled) */
    PAYOUT_INITIATED: 3001,

    /** Internal transfer */
    INTERNAL_TRANSFER: 4001,
} as const;

export type TransferCode = (typeof TransferCodes)[keyof typeof TransferCodes];
