export const BPS_SCALE = 10000n;

export const DAY_IN_SECONDS = 86400;
export const SYSTEM_TRANSFERS_LEDGER_ORG_ID =
  "00000000-0000-4000-8000-000000000002";

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

  /** Payout obligation created in destination currency */
  FX_PAYOUT_OBLIGATION: 2005,

  /** Outbound leg movement from reserve to treasury clearing */
  FX_LEG_OUT: 2009,

  /** Inbound leg movement from treasury clearing to reserve */
  FX_LEG_IN: 2010,

  /** Fee charged to customer and recognized as fee income */
  FEE_INCOME: 3001,

  /** Spread charged to customer and recognized as spread income */
  SPREAD_INCOME: 3002,

  /** Pass-through fee reserved from customer */
  FEE_PASS_THROUGH_RESERVE: 3003,

  /** Adjustment that increases charge */
  ADJUSTMENT_CHARGE: 3006,

  /** Adjustment that decreases charge */
  ADJUSTMENT_REFUND: 3007,

  /** Provider fee expense accrual */
  PROVIDER_FEE_EXPENSE_ACCRUAL: 3008,

  /** External fee payment initiated as pending transfer */
  FEE_PAYMENT_INITIATED: 3011,

  /** Payout initiated from treasury pool (pending until settled) */
  PAYOUT_INITIATED: 3101,

  /** Internal transfer */
  INTERNAL_TRANSFER: 4001,

  // Backward-compatible aliases for legacy code paths.
  FEE_REVENUE: 3001,
  SPREAD_REVENUE: 3002,
  FEE_SEPARATE_PAYMENT_RESERVE: 3003,
  BANK_FEE_REVENUE: 3001,
  BLOCKCHAIN_FEE_REVENUE: 3001,
  ARBITRARY_FEE_REVENUE: 3001,
  FEE_PAYMENT_SETTLED: 3011,
  FEE_PAYMENT_VOIDED: 3011,
} as const;

export type TransferCode = (typeof TransferCodes)[keyof typeof TransferCodes];
