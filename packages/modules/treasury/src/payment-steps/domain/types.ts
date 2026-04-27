export const PAYMENT_STEP_KIND_VALUES = [
  "payin",
  "fx_conversion",
  "payout",
  "intracompany_transfer",
  "intercompany_funding",
  "internal_transfer",
] as const;

export const PAYMENT_STEP_PURPOSE_VALUES = [
  "deal_leg",
  "pre_fund",
  "standalone_payment",
] as const;

export const PAYMENT_STEP_ORIGIN_TYPE_VALUES = [
  "deal_execution_leg",
  "treasury_order_step",
  "manual",
] as const;

export const PAYMENT_STEP_STATE_VALUES = [
  "draft",
  "scheduled",
  "pending",
  "processing",
  "completed",
  "failed",
  "returned",
  "cancelled",
  "skipped",
] as const;

export const PAYMENT_STEP_RATE_LOCKED_SIDE_VALUES = ["in", "out"] as const;

export const PAYMENT_STEP_ATTEMPT_OUTCOME_VALUES = [
  "pending",
  "settled",
  "failed",
  "voided",
  "returned",
] as const;

export const PAYMENT_STEP_SETTLEMENT_EVIDENCE_PURPOSE_VALUES = [
  "bank_confirmation",
  "settlement_confirmation",
  "counterparty_receipt",
] as const;

export type PaymentStepKind = (typeof PAYMENT_STEP_KIND_VALUES)[number];
export type PaymentStepOriginType =
  (typeof PAYMENT_STEP_ORIGIN_TYPE_VALUES)[number];
export type PaymentStepPurpose = (typeof PAYMENT_STEP_PURPOSE_VALUES)[number];
export type PaymentStepState = (typeof PAYMENT_STEP_STATE_VALUES)[number];
export type PaymentStepRateLockedSide =
  (typeof PAYMENT_STEP_RATE_LOCKED_SIDE_VALUES)[number];
export type PaymentStepAttemptOutcome =
  (typeof PAYMENT_STEP_ATTEMPT_OUTCOME_VALUES)[number];
export type PaymentStepSettlementEvidencePurpose =
  (typeof PAYMENT_STEP_SETTLEMENT_EVIDENCE_PURPOSE_VALUES)[number];

export interface PaymentStepPartyRef {
  id: string;
  requisiteId: string | null;
}

export interface PaymentStepRate {
  lockedSide: PaymentStepRateLockedSide;
  value: string;
}

export interface PostingDocumentRef {
  documentId: string;
  kind: string;
}

export type PostingDocumentRefRecord = PostingDocumentRef;

export interface ArtifactRef {
  fileAssetId: string;
  purpose: string;
}

export interface PaymentStepOrigin {
  dealId: string | null;
  planLegId: string | null;
  routeSnapshotLegId: string | null;
  sequence: number | null;
  treasuryOrderId: string | null;
  type: PaymentStepOriginType;
}

export interface PaymentStepRouteSnapshot {
  fromAmountMinor: bigint | null;
  fromCurrencyId: string;
  fromParty: PaymentStepPartyRef;
  rate: PaymentStepRate | null;
  toAmountMinor: bigint | null;
  toCurrencyId: string;
  toParty: PaymentStepPartyRef;
}

export interface PaymentStepAmendmentRecord {
  after: PaymentStepRouteSnapshot;
  before: PaymentStepRouteSnapshot;
  createdAt: Date;
  id: string;
}

export interface PaymentStepReturnRecord {
  amountMinor: bigint | null;
  createdAt: Date;
  currencyId: string | null;
  id: string;
  paymentStepId: string;
  providerRef: string | null;
  reason: string | null;
  returnedAt: Date;
  updatedAt: Date;
}

export interface PaymentStepAttemptRecord {
  attemptNo: number;
  createdAt: Date;
  id: string;
  outcome: PaymentStepAttemptOutcome;
  outcomeAt: Date | null;
  paymentStepId: string;
  providerRef: string | null;
  providerSnapshot: unknown;
  submittedAt: Date;
  updatedAt: Date;
}

export interface PaymentStepRecord {
  amendments: PaymentStepAmendmentRecord[];
  artifacts: ArtifactRef[];
  attempts: PaymentStepAttemptRecord[];
  completedAt: Date | null;
  createdAt: Date;
  dealId: string | null;
  failureReason: string | null;
  fromAmountMinor: bigint | null;
  fromCurrencyId: string;
  fromParty: PaymentStepPartyRef;
  id: string;
  kind: PaymentStepKind;
  currentRoute: PaymentStepRouteSnapshot;
  origin: PaymentStepOrigin;
  plannedRoute: PaymentStepRouteSnapshot;
  postingDocumentRefs: PostingDocumentRef[];
  purpose: PaymentStepPurpose;
  quoteId: string | null;
  rate: PaymentStepRate | null;
  returns: PaymentStepReturnRecord[];
  scheduledAt: Date | null;
  sourceRef: string;
  state: PaymentStepState;
  submittedAt: Date | null;
  toAmountMinor: bigint | null;
  toCurrencyId: string;
  toParty: PaymentStepPartyRef;
  treasuryBatchId: string | null;
  updatedAt: Date;
}
