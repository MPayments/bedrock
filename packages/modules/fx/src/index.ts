// Service
export { createFxService } from "./service";
export type { FxService } from "./service";
export type * from "./ports";

// Validation
export {
  validateSetManualRateInput,
  validateQuoteInput,
  validateMarkQuoteUsedInput,
  validateGetQuoteDetailsInput,
  validateListFxQuotesQuery,
  validateSyncRatesFromSourceInput,
  FX_QUOTES_LIST_CONTRACT,
  GetQuoteDetailsInputSchema,
  ListFxQuotesQuerySchema,
  QuoteInputSchema,
} from "./validation";
export type {
  SetManualRateInput,
  QuoteInput,
  MarkQuoteUsedInput,
  QuoteLegInput,
  PricingTrace,
  GetQuoteDetailsInput,
  ListFxQuotesQuery,
  SyncRatesFromSourceInput,
} from "./validation";

// Errors
export {
  FxError,
  ValidationError,
  NotFoundError,
  RateNotFoundError,
  QuoteExpiredError,
  RateSourceSyncError,
  RateSourceStaleError,
} from "./errors";
export type {
  FxRateSource,
  FxRateSourceStatus,
  FxRateSourceSyncResult,
  FxRateSourceProvider,
} from "./source-providers";

export {
  FxRateHistoryPointSchema,
  FxRateHistoryResponseSchema,
  FxRatePairSchema,
  FxRatePairsResponseSchema,
  FxRateSourceSchema,
  FxRateSourceStatusSchema,
  FxRateSourceStatusesResponseSchema,
  CreateFxQuoteInputSchema,
  FxQuoteDetailsResponseSchema,
  FxQuoteListItemSchema,
  FxQuoteListResponseSchema,
  FxQuoteFeeComponentSchema,
  FxQuoteFinancialLineSchema,
  FxQuoteLegInputSchema,
  FxQuoteLegSchema,
  FxQuotePricingTraceSchema,
  FxQuoteSchema,
  SetManualRateInputSchema,
  SetManualRateResponseSchema,
} from "./contracts";
export type {
  CreateFxQuoteInput,
  FxRateHistoryPoint,
  FxRatePair,
  FxQuoteListItem,
  FxQuoteListResponse,
  FxQuoteDetailsResponse,
} from "./contracts";

export type {
  RatePairView,
  SourceRateView,
} from "./commands/rates/list-pairs";

export type {
  RateHistoryPoint,
} from "./commands/rates/rate-history";
