import { z } from "zod";

import {
  amountValueSchema,
  toMinorAmountString,
} from "@bedrock/core/documents/module-kit";

const amountMinorSchema = z
  .union([z.bigint(), z.string().regex(/^-?\d+$/), z.number().int()])
  .transform((value) => BigInt(value));

const paymentIntentBaseShape = {
  direction: z.enum(["payin", "payout"]),
  sourceCounterpartyAccountId: z.uuid(),
  destinationCounterpartyAccountId: z.uuid(),
  currency: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((value) => value.toUpperCase()),
  corridor: z.string().trim().min(1).max(128).default("default"),
  providerConstraint: z.string().trim().min(1).max(128).optional(),
  countryFrom: z.string().trim().min(2).max(2).optional(),
  countryTo: z.string().trim().min(2).max(2).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  timeoutSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
  memo: z.string().max(1000).optional(),
  occurredAt: z.coerce.date(),
} as const;

export const PaymentIntentInputSchema = z
  .object({
    ...paymentIntentBaseShape,
    amount: amountValueSchema,
  })
  .transform((input, ctx) => {
    try {
      const amountMinor = BigInt(toMinorAmountString(input.amount, input.currency));
      const { amount: _amount, ...rest } = input;
      return {
        ...rest,
        amountMinor,
      };
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "amount is invalid",
      });
      return z.NEVER;
    }
  });

export const PaymentIntentPayloadSchema = z.object({
  ...paymentIntentBaseShape,
  amountMinor: amountMinorSchema,
});

export const PaymentResolutionPayloadSchema = z.object({
  intentDocumentId: z.uuid(),
  resolutionType: z.enum(["settle", "void", "fail"]),
  eventIdempotencyKey: z.string().trim().min(1).max(255),
  externalRef: z.string().trim().max(255).optional(),
  occurredAt: z.coerce.date(),
});

export type PaymentIntentPayload = z.infer<typeof PaymentIntentPayloadSchema>;
export type PaymentIntentInput = z.infer<typeof PaymentIntentInputSchema>;
export type PaymentResolutionPayload = z.infer<
  typeof PaymentResolutionPayloadSchema
>;
