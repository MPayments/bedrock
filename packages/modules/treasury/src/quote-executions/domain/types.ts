import type {
  PaymentStepOrigin,
  PaymentStepPartyRef,
  PostingDocumentRef,
} from "../../payment-steps/domain/types";

export const QUOTE_EXECUTION_STATE_VALUES = [
  "draft",
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;

export type QuoteExecutionState =
  (typeof QUOTE_EXECUTION_STATE_VALUES)[number];

export interface QuoteExecutionSettlementRoute {
  creditParty: PaymentStepPartyRef;
  debitParty: PaymentStepPartyRef;
}

export interface QuoteExecutionRecord {
  completedAt: Date | null;
  createdAt: Date;
  dealId: string | null;
  failureReason: string | null;
  fromAmountMinor: bigint;
  fromCurrencyId: string;
  id: string;
  origin: PaymentStepOrigin;
  postingDocumentRefs: PostingDocumentRef[];
  providerRef: string | null;
  providerSnapshot: unknown;
  quoteId: string;
  quoteLegIdx: number | null;
  quoteSnapshot: unknown;
  rateDen: bigint;
  rateNum: bigint;
  settlementRoute: QuoteExecutionSettlementRoute;
  sourceRef: string;
  state: QuoteExecutionState;
  submittedAt: Date | null;
  toAmountMinor: bigint;
  toCurrencyId: string;
  treasuryOrderId: string | null;
  updatedAt: Date;
}
