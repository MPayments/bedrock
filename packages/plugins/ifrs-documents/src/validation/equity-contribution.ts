import { z } from "zod";

import { amountMinorSchema } from "@bedrock/kernel/money";

import {
  amountValueInputSchema,
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  referenceSchema,
  withAmountMinor,
} from "./shared";

const equityContributionInputBaseSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  investorCounterpartyId: z.uuid().optional(),
  amount: amountValueInputSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export const EquityContributionInputSchema =
  equityContributionInputBaseSchema.transform((input, ctx) =>
    withAmountMinor(input, ctx),
  );

export const EquityContributionSchema = baseOccurredAtSchema.extend({
  counterpartyId: z.uuid(),
  investorCounterpartyId: z.uuid().optional(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  reference: referenceSchema,
  memo: memoSchema,
});

export type EquityContributionInput = z.infer<
  typeof EquityContributionInputSchema
>;
export type EquityContribution = z.infer<typeof EquityContributionSchema>;
