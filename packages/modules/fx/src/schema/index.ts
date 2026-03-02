import { fxQuoteLegs } from "./quote-legs";
import { fxQuotes } from "./quotes";
import { fxRateSources } from "./rate-sources";
import { fxRates } from "./rates";

export const schema = {
  fxRates,
  fxRateSources,
  fxQuotes,
  fxQuoteLegs,
};

export { fxQuoteLegs, fxQuotes, fxRateSources, fxRates };

export { type FxQuoteLeg } from "./quote-legs";
export { type FxQuote, type FxQuoteStatus } from "./quotes";
export {
  type FxRateSource,
  type FxRateSourceRow,
  type FxRateSourceSyncStatus,
} from "./rate-sources";
export { type FxRate, type FxRateInsert } from "./rates";
