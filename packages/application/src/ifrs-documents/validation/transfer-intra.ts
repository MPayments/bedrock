import { z } from "zod";

import { amountMinorSchema } from "@bedrock/core/documents/module-kit";

import {
  amountValueInputSchema,
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  withAmountMinor,
} from "./shared";

const transferInputBaseSchema = baseOccurredAtSchema.extend({
  sourceCounterpartyAccountId: z.uuid(),
  destinationCounterpartyAccountId: z.uuid(),
  amount: amountValueInputSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
  memo: memoSchema,
});

const transferPayloadBaseSchema = baseOccurredAtSchema.extend({
  sourceCounterpartyAccountId: z.uuid(),
  destinationCounterpartyAccountId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
  memo: memoSchema,
});

export const TransferIntraInputSchema = transferInputBaseSchema.transform(
  (input, ctx) => withAmountMinor(input, ctx),
);

export const TransferIntraPayloadSchema = transferPayloadBaseSchema.extend({
  sourceCounterpartyId: z.uuid(),
  destinationCounterpartyId: z.uuid(),
});

export type TransferIntraInput = z.infer<typeof TransferIntraInputSchema>;
export type TransferIntraPayload = z.infer<typeof TransferIntraPayloadSchema>;
