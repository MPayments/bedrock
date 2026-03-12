export const BPS_SCALE = 10000n;

export const DAY_IN_SECONDS = 86400;
export const SYSTEM_LEDGER_BOOK_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Treasury ledger transfer codes.
 *
 * Code ranges:
 * - 1xxx: Funding operations
 * - 2xxx: FX execution operations
 * - 3xxx: Payout operations
 * - 4xxx: Internal transfer operations
 * - 9xxx: External funding and opening balances
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

  /** Founder equity contribution */
  EXTERNAL_FUNDING_FOUNDER_EQUITY: 9001,

  /** Investor equity contribution */
  EXTERNAL_FUNDING_INVESTOR_EQUITY: 9002,

  /** Shareholder/investor loan funding */
  EXTERNAL_FUNDING_SHAREHOLDER_LOAN: 9003,

  /** Opening balance funding */
  EXTERNAL_FUNDING_OPENING_BALANCE: 9005,
} as const;

export type TransferCode = (typeof TransferCodes)[keyof typeof TransferCodes];
