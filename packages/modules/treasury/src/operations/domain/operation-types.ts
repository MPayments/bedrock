export const TREASURY_OPERATION_KIND_VALUES = [
  "payin",
  "payout",
  "fx_conversion",
  "intracompany_transfer",
  "intercompany_funding",
] as const;

export const TREASURY_OPERATION_STATE_VALUES = ["planned"] as const;

export type TreasuryOperationKind =
  (typeof TREASURY_OPERATION_KIND_VALUES)[number];
export type TreasuryOperationState =
  (typeof TREASURY_OPERATION_STATE_VALUES)[number];
