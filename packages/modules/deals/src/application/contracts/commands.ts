import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import {
  DealStatusSchema,
  DealTypeSchema,
} from "./zod";

const nullableText = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

const nullableShortText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

const nullableDecimalText = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Must be a positive decimal string")
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

export const CreateDealInputSchema = z.object({
  customerId: z.uuid(),
  agreementId: z.uuid().optional(),
  calculationId: z.uuid().nullable().optional(),
  type: DealTypeSchema,
  counterpartyId: z.uuid().optional(),
  agentId: nullableShortText,
  reason: nullableText,
  intakeComment: nullableText,
  comment: nullableText,
  requestedAmount: nullableDecimalText,
  requestedCurrencyId: z.uuid().nullable().optional(),
}).superRefine((value, ctx) => {
  const hasRequestedAmount = value.requestedAmount !== null;
  const hasRequestedCurrencyId = value.requestedCurrencyId != null;

  if (hasRequestedAmount !== hasRequestedCurrencyId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "requestedAmount and requestedCurrencyId must be provided together",
      path: hasRequestedAmount ? ["requestedCurrencyId"] : ["requestedAmount"],
    });
  }
});

export type CreateDealInput = z.infer<typeof CreateDealInputSchema>;

export const UpdateDealIntakeInputSchema = z
  .object({
    counterpartyId: z.uuid().nullable().optional(),
    agentId: nullableShortText.optional(),
    reason: nullableText.optional(),
    intakeComment: nullableText.optional(),
    comment: nullableText.optional(),
    requestedAmount: nullableDecimalText.optional(),
    requestedCurrencyId: z.uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const hasRequestedAmount = value.requestedAmount !== undefined;
    const hasRequestedCurrencyId = value.requestedCurrencyId !== undefined;

    if (hasRequestedAmount !== hasRequestedCurrencyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "requestedAmount and requestedCurrencyId must be patched together",
        path: hasRequestedAmount ? ["requestedCurrencyId"] : ["requestedAmount"],
      });
    }
  });

export type UpdateDealIntakeInput = z.infer<typeof UpdateDealIntakeInputSchema>;

export const AttachDealCalculationInputSchema = z.object({
  calculationId: z.uuid(),
});

export type AttachDealCalculationInput = z.infer<
  typeof AttachDealCalculationInputSchema
>;

export const TransitionDealStatusInputSchema = z.object({
  status: DealStatusSchema,
  comment: nullableText.optional(),
});

export type TransitionDealStatusInput = z.infer<
  typeof TransitionDealStatusInputSchema
>;
