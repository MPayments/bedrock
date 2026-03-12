import { z } from "zod";

import { amountMinorSchema } from "@bedrock/app/documents/module-kit";

import {
  amountValueInputSchema,
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  referenceSchema,
  withAmountMinor,
} from "./shared";

const intercompanyLoanInputBaseSchema = baseOccurredAtSchema.extend({
  debtorCounterpartyId: z.uuid(),
  creditorCounterpartyId: z.uuid(),
  amount: amountValueInputSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

const intercompanyLoanPayloadBaseSchema = baseOccurredAtSchema.extend({
  debtorCounterpartyId: z.uuid(),
  creditorCounterpartyId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const IntercompanyLoanDrawdownInputSchema =
  intercompanyLoanInputBaseSchema.transform((input, ctx) =>
    withAmountMinor(input, ctx),
  );

export const IntercompanyLoanDrawdownSchema = intercompanyLoanPayloadBaseSchema;

export type IntercompanyLoanDrawdownInput = z.infer<
  typeof IntercompanyLoanDrawdownInputSchema
>;
export type IntercompanyLoanDrawdown = z.infer<
  typeof IntercompanyLoanDrawdownSchema
>;
