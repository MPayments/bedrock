import { z } from "zod";

import { amountMinorSchema } from "@bedrock/kernel/money";

import {
  amountValueInputSchema,
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  withAmountMinor,
} from "./shared";

const transferIntercompanyInputBaseSchema = baseOccurredAtSchema.extend({
  sourceOrganizationId: z.uuid(),
  sourceRequisiteId: z.uuid(),
  destinationOrganizationId: z.uuid(),
  destinationRequisiteId: z.uuid(),
  amount: amountValueInputSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 60 * 60)
    .optional(),
  memo: memoSchema,
});

export const TransferIntercompanyInputSchema =
  transferIntercompanyInputBaseSchema.transform((input, ctx) =>
    withAmountMinor(input, ctx),
  );

export const TransferIntercompanyPayloadSchema = baseOccurredAtSchema.extend({
  sourceOrganizationId: z.uuid(),
  sourceRequisiteId: z.uuid(),
  destinationOrganizationId: z.uuid(),
  destinationRequisiteId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  timeoutSeconds: z
    .number()
    .int()
    .positive()
    .max(7 * 24 * 60 * 60)
    .optional(),
  memo: memoSchema,
});

export type TransferIntercompanyInput = z.infer<
  typeof TransferIntercompanyInputSchema
>;
export type TransferIntercompanyPayload = z.infer<
  typeof TransferIntercompanyPayloadSchema
>;
