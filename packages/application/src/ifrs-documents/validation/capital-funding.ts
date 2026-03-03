import { z } from "zod";

import { amountMinorSchema } from "@bedrock/core/documents/module-kit";

import {
  amountValueInputSchema,
  baseOccurredAtSchema,
  currencyCodeSchema,
  memoSchema,
  withAmountMinor,
} from "./shared";

export const CapitalFundingKindSchema = z.enum([
  "founder_equity",
  "investor_equity",
  "shareholder_loan",
  "opening_balance",
]);

const capitalFundingInputBaseSchema = baseOccurredAtSchema.extend({
  kind: CapitalFundingKindSchema,
  entryRef: z.string().trim().min(1).max(255),
  counterpartyId: z.uuid(),
  counterpartyAccountId: z.uuid(),
  amount: amountValueInputSchema,
  currency: currencyCodeSchema,
  memo: memoSchema,
});

export const CapitalFundingInputSchema = capitalFundingInputBaseSchema.transform(
  (input, ctx) => withAmountMinor(input, ctx),
);

export const CapitalFundingPayloadSchema = baseOccurredAtSchema.extend({
  kind: CapitalFundingKindSchema,
  entryRef: z.string().trim().min(1).max(255),
  counterpartyId: z.uuid(),
  counterpartyAccountId: z.uuid(),
  amountMinor: amountMinorSchema,
  currency: currencyCodeSchema,
  memo: memoSchema,
});

export type CapitalFundingInput = z.infer<typeof CapitalFundingInputSchema>;
export type CapitalFundingPayload = z.infer<typeof CapitalFundingPayloadSchema>;
