// Service
export { createFxService } from "./service";
export type { FxService } from "./service";

// Validation
export {
  validateSetManualRateInput,
  validateQuoteInput,
  validateMarkQuoteUsedInput,
  validateGetQuoteDetailsInput,
  validateSyncRatesFromSourceInput,
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

export { createFxRatesWorkerDefinition } from "./worker";
export type {
  FxRateSource,
  FxRateSourceStatus,
  FxRateSourceSyncResult,
} from "./sources";

export {
  FxRateHistoryPointSchema,
  FxRateHistoryResponseSchema,
  FxRatePairSchema,
  FxRatePairsResponseSchema,
  FxRateSourceSchema,
  FxRateSourceStatusSchema,
  FxRateSourceStatusesResponseSchema,
  SetManualRateInputSchema,
  SetManualRateResponseSchema,
} from "./contracts";
export type {
  FxRateHistoryPoint,
  FxRatePair,
} from "./contracts";

export type {
  RatePairView,
  SourceRateView,
} from "./commands/rates/list-pairs";

export type {
  RateHistoryPoint,
} from "./commands/rates/rate-history";
