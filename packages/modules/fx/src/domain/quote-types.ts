export type FxQuoteStatus = "active" | "used" | "expired" | "cancelled";
export type FxQuotePricingMode = "auto_cross" | "explicit_route";
export type FxQuoteLegSourceKind =
  | "cb"
  | "bank"
  | "manual"
  | "derived"
  | "market";

export interface ComputedLeg {
  idx: number;
  fromCurrency: string;
  toCurrency: string;
  fromAmountMinor: bigint;
  toAmountMinor: bigint;
  rateNum: bigint;
  rateDen: bigint;
  sourceKind: FxQuoteLegSourceKind;
  sourceRef: string | null;
  asOf: Date;
  executionCounterpartyId: string | null;
}
