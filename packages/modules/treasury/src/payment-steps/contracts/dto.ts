import { z } from "zod";

import {
  PAYMENT_STEP_ATTEMPT_OUTCOME_VALUES,
  PAYMENT_STEP_DEAL_LEG_ROLE_VALUES,
  PAYMENT_STEP_KIND_VALUES,
  PAYMENT_STEP_PURPOSE_VALUES,
  PAYMENT_STEP_RATE_LOCKED_SIDE_VALUES,
  PAYMENT_STEP_SETTLEMENT_EVIDENCE_PURPOSE_VALUES,
  PAYMENT_STEP_STATE_VALUES,
} from "../domain/types";

export const PaymentStepKindSchema = z.enum(PAYMENT_STEP_KIND_VALUES);
export const PaymentStepPurposeSchema = z.enum(PAYMENT_STEP_PURPOSE_VALUES);
export const PaymentStepStateSchema = z.enum(PAYMENT_STEP_STATE_VALUES);
export const PaymentStepDealLegRoleSchema = z.enum(
  PAYMENT_STEP_DEAL_LEG_ROLE_VALUES,
);
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
  id: z.uuid(),
  requisiteId: z.uuid().nullable(),
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
  artifacts: z.array(ArtifactRefSchema),
  attempts: z.array(PaymentStepAttemptSchema),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  dealId: z.uuid().nullable(),
  dealLegIdx: z.number().int().nonnegative().nullable(),
  dealLegRole: PaymentStepDealLegRoleSchema.nullable(),
  failureReason: z.string().nullable(),
  fromAmountMinor: z.bigint().nullable(),
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  id: z.uuid(),
  kind: PaymentStepKindSchema,
  postings: z.array(PostingDocumentRefSchema),
  purpose: PaymentStepPurposeSchema,
  rate: PaymentStepRateSchema.nullable(),
  scheduledAt: z.date().nullable(),
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
export type PaymentStepAttempt = z.infer<typeof PaymentStepAttemptSchema>;
export type PaymentStepAttemptOutcome = z.infer<
  typeof PaymentStepAttemptOutcomeSchema
>;
export type PaymentStepDealLegRole = z.infer<
  typeof PaymentStepDealLegRoleSchema
>;
export type PaymentStepKind = z.infer<typeof PaymentStepKindSchema>;
export type PaymentStepPartyRef = z.infer<typeof PaymentStepPartyRefSchema>;
export type PaymentStepPurpose = z.infer<typeof PaymentStepPurposeSchema>;
export type PaymentStepRate = z.infer<typeof PaymentStepRateSchema>;
export type PaymentStepRateLockedSide = z.infer<
  typeof PaymentStepRateLockedSideSchema
>;
export type PaymentStepState = z.infer<typeof PaymentStepStateSchema>;
export type PaymentStepSettlementEvidencePurpose = z.infer<
  typeof PaymentStepSettlementEvidencePurposeSchema
>;
export type PostingDocumentRef = z.infer<typeof PostingDocumentRefSchema>;
