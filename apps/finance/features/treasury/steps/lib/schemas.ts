import { z } from "zod";

import {
  ArtifactRefSchema,
  PaymentStepKindSchema,
  PaymentStepOriginSchema,
  PaymentStepPartyRefSchema,
  PaymentStepPurposeSchema,
  PaymentStepRateLockedSideSchema,
  PaymentStepStateSchema,
  PostingDocumentRefSchema,
} from "@bedrock/treasury/contracts";

/**
 * Wire-shape of a {@link FinanceDealPaymentStep} / treasury-operations row.
 *
 * Dates are ISO strings and amounts are decimal strings so JSON round-trips
 * cleanly (the domain schema uses `bigint` / `Date`). This schema is the
 * single source of truth for PaymentStep in finance-side UI — both the deal
 * workbench and the treasury operations screen parse API responses through
 * it.
 */
const FinanceDealPaymentStepAttemptSchema = z.object({
  attemptNo: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  id: z.string().uuid(),
  outcome: z.enum(["pending", "settled", "failed", "voided", "returned"]),
  outcomeAt: z.iso.datetime().nullable(),
  paymentStepId: z.string().uuid(),
  providerRef: z.string().nullable(),
  providerSnapshot: z.unknown(),
  submittedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const FinancePaymentStepRouteSchema = z.object({
  fromAmountMinor: z.string().nullable(),
  fromCurrencyId: z.string().uuid(),
  fromParty: PaymentStepPartyRefSchema,
  rate: z
    .object({
      lockedSide: PaymentStepRateLockedSideSchema,
      value: z.string(),
    })
    .nullable(),
  toAmountMinor: z.string().nullable(),
  toCurrencyId: z.string().uuid(),
  toParty: PaymentStepPartyRefSchema,
});

const FinancePaymentStepAmendmentSchema = z.object({
  after: FinancePaymentStepRouteSchema,
  before: FinancePaymentStepRouteSchema,
  createdAt: z.iso.datetime(),
  id: z.string(),
});

const FinancePaymentStepReturnSchema = z.object({
  amountMinor: z.string().nullable(),
  createdAt: z.iso.datetime(),
  currencyId: z.string().uuid().nullable(),
  id: z.string(),
  paymentStepId: z.string().uuid(),
  providerRef: z.string().nullable(),
  reason: z.string().nullable(),
  returnedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const FinanceDealPaymentStepSchema = z.object({
  amendments: z.array(FinancePaymentStepAmendmentSchema),
  artifacts: z.array(ArtifactRefSchema),
  attempts: z.array(FinanceDealPaymentStepAttemptSchema),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  dealId: z.string().uuid().nullable(),
  failureReason: z.string().nullable(),
  fromAmountMinor: z.string().nullable(),
  fromCurrencyId: z.string().uuid(),
  fromParty: PaymentStepPartyRefSchema,
  id: z.string().uuid(),
  kind: PaymentStepKindSchema,
  currentRoute: FinancePaymentStepRouteSchema,
  origin: PaymentStepOriginSchema,
  plannedRoute: FinancePaymentStepRouteSchema,
  postingDocumentRefs: z.array(PostingDocumentRefSchema),
  purpose: PaymentStepPurposeSchema,
  quoteId: z.string().uuid().nullable(),
  rate: z
    .object({
      lockedSide: PaymentStepRateLockedSideSchema,
      value: z.string(),
    })
    .nullable(),
  returns: z.array(FinancePaymentStepReturnSchema),
  scheduledAt: z.iso.datetime().nullable(),
  sourceRef: z.string(),
  state: PaymentStepStateSchema,
  submittedAt: z.iso.datetime().nullable(),
  toAmountMinor: z.string().nullable(),
  toCurrencyId: z.string().uuid(),
  toParty: PaymentStepPartyRefSchema,
  treasuryBatchId: z.string().uuid().nullable(),
  updatedAt: z.iso.datetime(),
});

export type FinanceDealPaymentStep = z.infer<
  typeof FinanceDealPaymentStepSchema
>;
export type FinanceDealPaymentStepAttempt = z.infer<
  typeof FinanceDealPaymentStepAttemptSchema
>;
