import { z } from "zod";

import {
  PAYMENT_STEP_ATTEMPT_OUTCOME_VALUES,
  PAYMENT_STEP_KIND_VALUES,
  PAYMENT_STEP_ORIGIN_TYPE_VALUES,
  PAYMENT_STEP_PURPOSE_VALUES,
  PAYMENT_STEP_RATE_LOCKED_SIDE_VALUES,
  PAYMENT_STEP_SETTLEMENT_EVIDENCE_PURPOSE_VALUES,
  PAYMENT_STEP_STATE_VALUES,
} from "../domain/types";

export const PaymentStepKindSchema = z.enum(PAYMENT_STEP_KIND_VALUES);
export const PaymentStepOriginTypeSchema = z.enum(
  PAYMENT_STEP_ORIGIN_TYPE_VALUES,
);
export const PaymentStepPurposeSchema = z.enum(PAYMENT_STEP_PURPOSE_VALUES);
export const PaymentStepStateSchema = z.enum(PAYMENT_STEP_STATE_VALUES);
export const PaymentStepRateLockedSideSchema = z.enum(
  PAYMENT_STEP_RATE_LOCKED_SIDE_VALUES,
);
export const PaymentStepAttemptOutcomeSchema = z.enum(
  PAYMENT_STEP_ATTEMPT_OUTCOME_VALUES,
);
export const PaymentStepSettlementEvidencePurposeSchema = z.enum(
  PAYMENT_STEP_SETTLEMENT_EVIDENCE_PURPOSE_VALUES,
);

export const PaymentStepPartyRefSchema = z.object({
  displayName: z.string().trim().min(1).max(255).nullable().optional(),
  entityKind: z.string().trim().min(1).max(64).nullable().optional(),
  id: z.uuid(),
  requisiteId: z.uuid().nullable(),
  snapshot: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const PaymentStepRateSchema = z.object({
  lockedSide: PaymentStepRateLockedSideSchema,
  value: z.string(),
});

export const PostingDocumentRefSchema = z.object({
  documentId: z.uuid(),
  kind: z.string(),
});

export const ArtifactRefSchema = z.object({
  fileAssetId: z.uuid(),
  purpose: z.string(),
});

export const PaymentStepOriginSchema = z.object({
  dealId: z.uuid().nullable(),
  planLegId: z.string().trim().min(1).nullable(),
  routeSnapshotLegId: z.string().trim().min(1).nullable(),
  sequence: z.number().int().nonnegative().nullable(),
  treasuryOrderId: z.uuid().nullable(),
  type: PaymentStepOriginTypeSchema,
});

export const PaymentStepRouteSnapshotSchema = z.object({
  fromAmountMinor: z.bigint().nullable(),
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  rate: PaymentStepRateSchema.nullable(),
  toAmountMinor: z.bigint().nullable(),
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyRefSchema,
});

export const PaymentStepAmendmentSchema = z.object({
  after: PaymentStepRouteSnapshotSchema,
  before: PaymentStepRouteSnapshotSchema,
  createdAt: z.date(),
  id: z.string(),
});

export const PaymentStepReturnSchema = z.object({
  amountMinor: z.bigint().nullable(),
  createdAt: z.date(),
  currencyId: z.uuid().nullable(),
  id: z.uuid().or(z.string().min(1)),
  paymentStepId: z.uuid(),
  providerRef: z.string().nullable(),
  reason: z.string().nullable(),
  returnedAt: z.date(),
  updatedAt: z.date(),
});

export const PaymentStepAttemptSchema = z.object({
  attemptNo: z.number().int().positive(),
  createdAt: z.date(),
  id: z.uuid(),
  outcome: PaymentStepAttemptOutcomeSchema,
  outcomeAt: z.date().nullable(),
  paymentStepId: z.uuid(),
  providerRef: z.string().nullable(),
  providerSnapshot: z.unknown(),
  submittedAt: z.date(),
  updatedAt: z.date(),
});

export const PaymentStepSchema = z.object({
  amendments: z.array(PaymentStepAmendmentSchema),
  artifacts: z.array(ArtifactRefSchema),
  attempts: z.array(PaymentStepAttemptSchema),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  dealId: z.uuid().nullable(),
  failureReason: z.string().nullable(),
  fromAmountMinor: z.bigint().nullable(),
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  id: z.uuid(),
  kind: PaymentStepKindSchema,
  currentRoute: PaymentStepRouteSnapshotSchema,
  origin: PaymentStepOriginSchema,
  plannedRoute: PaymentStepRouteSnapshotSchema,
  postingDocumentRefs: z.array(PostingDocumentRefSchema),
  purpose: PaymentStepPurposeSchema,
  quoteId: z.uuid().nullable(),
  rate: PaymentStepRateSchema.nullable(),
  returns: z.array(PaymentStepReturnSchema),
  scheduledAt: z.date().nullable(),
  sourceRef: z.string(),
  state: PaymentStepStateSchema,
  submittedAt: z.date().nullable(),
  toAmountMinor: z.bigint().nullable(),
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyRefSchema,
  treasuryBatchId: z.uuid().nullable(),
  updatedAt: z.date(),
});

export type ArtifactRef = z.infer<typeof ArtifactRefSchema>;
export type PaymentStep = z.infer<typeof PaymentStepSchema>;
export type PaymentStepAmendment = z.infer<typeof PaymentStepAmendmentSchema>;
export type PaymentStepAttempt = z.infer<typeof PaymentStepAttemptSchema>;
export type PaymentStepAttemptOutcome = z.infer<
  typeof PaymentStepAttemptOutcomeSchema
>;
export type PaymentStepKind = z.infer<typeof PaymentStepKindSchema>;
export type PaymentStepOrigin = z.infer<typeof PaymentStepOriginSchema>;
export type PaymentStepOriginType = z.infer<typeof PaymentStepOriginTypeSchema>;
export type PaymentStepPartyRef = z.infer<typeof PaymentStepPartyRefSchema>;
export type PaymentStepPurpose = z.infer<typeof PaymentStepPurposeSchema>;
export type PaymentStepRate = z.infer<typeof PaymentStepRateSchema>;
export type PaymentStepRateLockedSide = z.infer<
  typeof PaymentStepRateLockedSideSchema
>;
export type PaymentStepReturn = z.infer<typeof PaymentStepReturnSchema>;
export type PaymentStepRouteSnapshot = z.infer<
  typeof PaymentStepRouteSnapshotSchema
>;
export type PaymentStepState = z.infer<typeof PaymentStepStateSchema>;
export type PaymentStepSettlementEvidencePurpose = z.infer<
  typeof PaymentStepSettlementEvidencePurposeSchema
>;
export type PostingDocumentRef = z.infer<typeof PostingDocumentRefSchema>;
