import type { z } from "zod";

import type {
  CreateFxQuoteInputSchema,
  FxQuoteDetailsResponseSchema,
  FxQuoteFeeComponentSchema,
  FxQuoteFinancialLineSchema,
  FxQuoteLegInputSchema,
  FxQuoteLegSchema,
  FxQuoteListItemSchema,
  FxQuoteListResponseSchema,
  FxQuotePricingTraceSchema,
  FxQuoteSchema,
  FxRateHistoryPointSchema,
  FxRatePairSchema,
  FxRateSourceSchema,
  FxRateSourceStatusSchema,
  SetManualRateInputSchema,
} from "./zod";
import type { ListFxQuotesQuerySchema } from "./queries";

export type FxRateSource = z.infer<typeof FxRateSourceSchema>;
export type FxRatePair = z.infer<typeof FxRatePairSchema>;
export type FxRateHistoryPoint = z.infer<typeof FxRateHistoryPointSchema>;
export type FxRateSourceStatus = z.infer<typeof FxRateSourceStatusSchema>;
export type SetManualRateInput = z.infer<typeof SetManualRateInputSchema>;
export type ListFxQuotesQuery = z.infer<typeof ListFxQuotesQuerySchema>;
export type CreateFxQuoteInput = z.infer<typeof CreateFxQuoteInputSchema>;
export type FxQuoteFinancialLine = z.infer<typeof FxQuoteFinancialLineSchema>;
export type FxQuoteLegInput = z.infer<typeof FxQuoteLegInputSchema>;
export type FxQuotePricingTrace = z.infer<typeof FxQuotePricingTraceSchema>;
export type FxQuote = z.infer<typeof FxQuoteSchema>;
export type FxQuoteListItem = z.infer<typeof FxQuoteListItemSchema>;
export type FxQuoteLeg = z.infer<typeof FxQuoteLegSchema>;
export type FxQuoteFeeComponent = z.infer<typeof FxQuoteFeeComponentSchema>;
export type FxQuoteDetailsResponse = z.infer<
  typeof FxQuoteDetailsResponseSchema
>;
export type FxQuoteListResponse = z.infer<typeof FxQuoteListResponseSchema>;
