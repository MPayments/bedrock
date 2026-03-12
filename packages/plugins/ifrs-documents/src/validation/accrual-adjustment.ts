import { z } from "zod";

import { amountMinorSchema } from "@bedrock/documents/module-kit";

import {
  amountValueInputSchema,
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  referenceSchema,
  withAmountMinor,
} from "./shared";

const adjustmentInputBaseSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  amount: amountValueInputSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

const adjustmentPayloadBaseSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const AccrualAdjustmentInputSchema = adjustmentInputBaseSchema.transform(
  (input, ctx) => withAmountMinor(input, ctx),
);

export const AccrualAdjustmentSchema = adjustmentPayloadBaseSchema;

export type AccrualAdjustmentInput = z.infer<typeof AccrualAdjustmentInputSchema>;
export type AccrualAdjustment = z.infer<typeof AccrualAdjustmentSchema>;
