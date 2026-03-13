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
  validateSyncRatesFromSourceInput,
  GetQuoteDetailsInputSchema,
  QuoteInputSchema,
} from "./validation";
export type {
  SetManualRateInput,
  QuoteInput,
  MarkQuoteUsedInput,
  QuoteLegInput,
  PricingTrace,
  GetQuoteDetailsInput,
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
  FxQuoteDetailsResponse,
} from "./contracts";

export type {
  RatePairView,
  SourceRateView,
} from "./commands/rates/list-pairs";

export type {
  RateHistoryPoint,
} from "./commands/rates/rate-history";
