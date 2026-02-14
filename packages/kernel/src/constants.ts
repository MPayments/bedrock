export const BPS_SCALE = 10000n;

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

    /** Generic fee revenue code */
    FEE_REVENUE: 2002,

    /** Generic spread revenue code */
    SPREAD_REVENUE: 2003,

    /** Pay-in committed to intercompany net position */
    FX_INTERCOMPANY_COMMIT: 2004,

    /** Payout obligation created in destination currency */
    FX_PAYOUT_OBLIGATION: 2005,

    /** Bank fee captured as revenue */
    BANK_FEE_REVENUE: 2006,

    /** Blockchain/network fee captured as revenue */
    BLOCKCHAIN_FEE_REVENUE: 2007,

    /** Arbitrary fee captured as revenue */
    ARBITRARY_FEE_REVENUE: 2008,

    /** Payout initiated from treasury pool (pending until settled) */
    PAYOUT_INITIATED: 3001,

    /** Fee reserved for separate payment order settlement */
    FEE_SEPARATE_PAYMENT_RESERVE: 3002,

    /** Internal transfer */
    INTERNAL_TRANSFER: 4001,
} as const;

export type TransferCode = (typeof TransferCodes)[keyof typeof TransferCodes];
