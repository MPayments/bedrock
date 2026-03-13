import { z } from "zod";

import { amountMinorSchema } from "@bedrock/money";

import {
  amountValueInputSchema,
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  referenceSchema,
  withAmountMinor,
} from "./shared";

const intercompanyInterestAccrualInputBaseSchema = baseOccurredAtSchema.extend({
  debtorCounterpartyId: z.uuid(),
  creditorCounterpartyId: z.uuid(),
  amount: amountValueInputSchema,
  currency: currencyCodeSchema,
  accrualPeriodMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  reference: referenceSchema,
  memo: memoSchema,
});

const intercompanyInterestAccrualPayloadSchema = baseOccurredAtSchema.extend({
  debtorCounterpartyId: z.uuid(),
  creditorCounterpartyId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  accrualPeriodMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  reference: referenceSchema,
  memo: memoSchema,
});

export const IntercompanyInterestAccrualInputSchema =
  intercompanyInterestAccrualInputBaseSchema.transform((input, ctx) =>
    withAmountMinor(input, ctx),
  );

export const IntercompanyInterestAccrualSchema =
  intercompanyInterestAccrualPayloadSchema;

export type IntercompanyInterestAccrualInput = z.infer<
  typeof IntercompanyInterestAccrualInputSchema
>;
export type IntercompanyInterestAccrual = z.infer<
  typeof IntercompanyInterestAccrualSchema
>;
