import { z } from "zod";

import {
  ArtifactRefSchema,
  PaymentStepKindSchema,
  PaymentStepOriginSchema,
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

export const CreatePaymentStepInputSchema = z
  .object({
    dealId: OptionalUuidSchema,
    fromAmountMinor: OptionalAmountMinorSchema,
    fromCurrencyId: z.uuid(),
    fromParty: PaymentStepPartyRefSchema,
    id: z.uuid().optional(),
    initialState: z
      .enum([PaymentStepStateSchema.enum.draft, PaymentStepStateSchema.enum.pending])
      .optional()
      .default("draft"),
    kind: PaymentStepKindSchema,
    origin: PaymentStepOriginSchema.optional(),
    planLegId: z.string().trim().min(1).nullable().optional().default(null),
    purpose: PaymentStepPurposeSchema,
    quoteId: z.uuid().nullable().optional().default(null),
    rate: PaymentStepRateSchema.nullable().optional().default(null),
    routeSnapshotLegId: z.string().trim().min(1).nullable().optional().default(null),
    sequence: z.number().int().nonnegative().nullable().optional().default(null),
    sourceRef: z.string().trim().min(1).max(512).optional(),
    toAmountMinor: OptionalAmountMinorSchema,
    toCurrencyId: z.uuid(),
    toParty: PaymentStepPartyRefSchema,
    treasuryBatchId: OptionalUuidSchema,
    treasuryOrderId: OptionalUuidSchema,
  })
  .superRefine((value, context) => {
    if (value.purpose !== "deal_leg") return;
    if (
      value.origin?.type !== "deal_execution_leg" ||
      value.origin.dealId !== value.dealId ||
      value.origin.planLegId === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Deal execution payment steps require origin.type=deal_execution_leg and origin.planLegId",
        path: ["origin"],
      });
    }
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

export const RecordPaymentStepReturnInputSchema = z.object({
  amountMinor: OptionalAmountMinorSchema,
  currencyId: z.uuid().nullable().optional().default(null),
  providerRef: OptionalProviderRefSchema,
  reason: OptionalFailureReasonSchema,
  returnId: z.uuid().optional(),
  returnedAt: z.date().optional(),
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

export const AttachPaymentStepPostingInputSchema = z.object({
  documentId: z.uuid(),
  kind: z.string().trim().min(1).max(64),
  stepId: z.uuid(),
});

export type AmendPaymentStepInput = z.infer<typeof AmendPaymentStepInputSchema>;
export type AttachPaymentStepPostingInput = z.infer<
  typeof AttachPaymentStepPostingInputSchema
>;
export type CancelPaymentStepInput = z.infer<typeof CancelPaymentStepInputSchema>;
export type ConfirmPaymentStepInput = z.infer<typeof ConfirmPaymentStepInputSchema>;
export type CreatePaymentStepInput = z.infer<typeof CreatePaymentStepInputSchema>;
export type RecordPaymentStepReturnInput = z.infer<
  typeof RecordPaymentStepReturnInputSchema
>;
export type SkipPaymentStepInput = z.infer<typeof SkipPaymentStepInputSchema>;
export type SubmitPaymentStepInput = z.infer<typeof SubmitPaymentStepInputSchema>;
