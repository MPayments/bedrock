import { z } from "zod";

import {
  PaymentStepOriginSchema,
  PaymentStepPartyRefSchema,
  PostingDocumentRefSchema,
} from "../../payment-steps/contracts/dto";
import { QUOTE_EXECUTION_STATE_VALUES } from "../domain/types";

export const QuoteExecutionStateSchema = z.enum(
  QUOTE_EXECUTION_STATE_VALUES,
);

export const QuoteExecutionSettlementRouteSchema = z.object({
  creditParty: PaymentStepPartyRefSchema,
  debitParty: PaymentStepPartyRefSchema,
});

export const QuoteExecutionSchema = z.object({
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  dealId: z.uuid().nullable(),
  failureReason: z.string().nullable(),
  fromAmountMinor: z.bigint(),
  fromCurrencyId: z.uuid(),
  id: z.uuid(),
  origin: PaymentStepOriginSchema,
  postingDocumentRefs: z.array(PostingDocumentRefSchema),
  providerRef: z.string().nullable(),
  providerSnapshot: z.unknown(),
  quoteId: z.uuid(),
  quoteLegIdx: z.number().int().positive().nullable(),
  quoteSnapshot: z.unknown(),
  rateDen: z.bigint(),
  rateNum: z.bigint(),
  settlementRoute: QuoteExecutionSettlementRouteSchema,
  sourceRef: z.string(),
  state: QuoteExecutionStateSchema,
  submittedAt: z.date().nullable(),
  toAmountMinor: z.bigint(),
  toCurrencyId: z.uuid(),
  treasuryOrderId: z.uuid().nullable(),
  updatedAt: z.date(),
});

export type QuoteExecution = z.infer<typeof QuoteExecutionSchema>;
export type QuoteExecutionSettlementRoute = z.infer<
  typeof QuoteExecutionSettlementRouteSchema
>;
export type QuoteExecutionState = z.infer<typeof QuoteExecutionStateSchema>;
