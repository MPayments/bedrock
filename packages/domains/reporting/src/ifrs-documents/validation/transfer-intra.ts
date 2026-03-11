import { z } from "zod";

import { amountMinorSchema } from "@multihansa/documents/actions";

import {
  amountValueInputSchema,
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  withAmountMinor,
} from "./shared";

const transferInputBaseSchema = baseOccurredAtSchema.extend({
  organizationId: z.uuid(),
  sourceRequisiteId: z.uuid(),
  destinationRequisiteId: z.uuid(),
  amount: amountValueInputSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
  memo: memoSchema,
});

const transferPayloadBaseSchema = baseOccurredAtSchema.extend({
  organizationId: z.uuid(),
  sourceRequisiteId: z.uuid(),
  destinationRequisiteId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z.number().int().positive().max(7 * 24 * 60 * 60).optional(),
  memo: memoSchema,
});

export const TransferIntraInputSchema = transferInputBaseSchema.transform(
  (input, ctx) => withAmountMinor(input, ctx),
);

export const TransferIntraPayloadSchema = transferPayloadBaseSchema;

export type TransferIntraInput = z.infer<typeof TransferIntraInputSchema>;
export type TransferIntraPayload = z.infer<typeof TransferIntraPayloadSchema>;
