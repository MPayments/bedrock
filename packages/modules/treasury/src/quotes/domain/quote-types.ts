export type QuoteStatus = "active" | "used" | "expired" | "cancelled";
export type QuotePricingMode = "auto_cross" | "explicit_route";
export type QuoteLegSourceKind =
  | "cb"
  | "bank"
  | "manual"
  | "derived"
  | "market";
