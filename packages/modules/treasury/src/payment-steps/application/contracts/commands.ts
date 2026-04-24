import { z } from "zod";

import {
  ArtifactRefSchema,
  PaymentStepDealLegRoleSchema,
  PaymentStepKindSchema,
  PaymentStepPartyRefSchema,
  PaymentStepPurposeSchema,
  PaymentStepRateSchema,
  PaymentStepStateSchema,
} from "../../contracts/dto";

const OptionalUuidSchema = z.uuid().nullable().optional().default(null);
const OptionalAmountMinorSchema =
  z.bigint().positive().nullable().optional().default(null);
const OptionalFailureReasonSchema =
  z.string().trim().max(1000).nullable().optional().default(null);
const OptionalProviderRefSchema =
  z.string().trim().min(1).max(255).nullable().optional().default(null);

export const CreatePaymentStepInputSchema = z.object({
  dealId: OptionalUuidSchema,
  dealLegIdx: z.number().int().nonnegative().nullable().optional().default(null),
  dealLegRole: PaymentStepDealLegRoleSchema.nullable().optional().default(null),
  fromAmountMinor: OptionalAmountMinorSchema,
  fromCurrencyId: z.uuid(),
  fromParty: PaymentStepPartyRefSchema,
  id: z.uuid().optional(),
  initialState: z
    .enum([PaymentStepStateSchema.enum.draft, PaymentStepStateSchema.enum.pending])
    .optional()
    .default("draft"),
  kind: PaymentStepKindSchema,
  purpose: PaymentStepPurposeSchema,
  rate: PaymentStepRateSchema.nullable().optional().default(null),
  toAmountMinor: OptionalAmountMinorSchema,
  toCurrencyId: z.uuid(),
  toParty: PaymentStepPartyRefSchema,
  treasuryBatchId: OptionalUuidSchema,
});

export const SubmitPaymentStepInputSchema = z.object({
  attemptId: z.uuid().optional(),
  providerRef: OptionalProviderRefSchema,
  providerSnapshot: z.unknown().optional().default(null),
  stepId: z.uuid(),
});

export const ConfirmPaymentStepInputSchema = z.object({
  artifacts: z.array(ArtifactRefSchema).optional().default([]),
  attemptId: z.uuid().optional(),
  failureReason: OptionalFailureReasonSchema,
  outcome: z.enum(["settled", "failed", "returned"]),
  stepId: z.uuid(),
});

export const CancelPaymentStepInputSchema = z.object({
  stepId: z.uuid(),
});

export const AmendPaymentStepInputSchema = z.object({
  fromAmountMinor: OptionalAmountMinorSchema.optional(),
  fromCurrencyId: z.uuid().optional(),
  fromParty: PaymentStepPartyRefSchema.optional(),
  rate: PaymentStepRateSchema.nullable().optional(),
  stepId: z.uuid(),
  toAmountMinor: OptionalAmountMinorSchema.optional(),
  toCurrencyId: z.uuid().optional(),
  toParty: PaymentStepPartyRefSchema.optional(),
});

export const SkipPaymentStepInputSchema = z.object({
  stepId: z.uuid(),
});

export type AmendPaymentStepInput = z.infer<typeof AmendPaymentStepInputSchema>;
export type CancelPaymentStepInput = z.infer<typeof CancelPaymentStepInputSchema>;
export type ConfirmPaymentStepInput = z.infer<typeof ConfirmPaymentStepInputSchema>;
export type CreatePaymentStepInput = z.infer<typeof CreatePaymentStepInputSchema>;
export type SkipPaymentStepInput = z.infer<typeof SkipPaymentStepInputSchema>;
export type SubmitPaymentStepInput = z.infer<typeof SubmitPaymentStepInputSchema>;
