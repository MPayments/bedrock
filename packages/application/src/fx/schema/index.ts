import { fxQuoteFinancialLines } from "./quote-financial-lines";
import { fxQuoteLegs } from "./quote-legs";
import { fxQuotes } from "./quotes";
import { fxRateSources } from "./rate-sources";
import { fxRates } from "./rates";

export const schema = {
  fxRates,
  fxRateSources,
  fxQuotes,
  fxQuoteFinancialLines,
  fxQuoteLegs,
};

export {
  fxQuoteFinancialLines,
  fxQuoteLegs,
  fxQuotes,
  fxRateSources,
  fxRates,
};

export { type FxQuoteFinancialLine } from "./quote-financial-lines";
export { type FxQuoteLeg } from "./quote-legs";
export { type FxQuote, type FxQuoteStatus } from "./quotes";
export {
  type FxRateSource,
  type FxRateSourceRow,
  type FxRateSourceSyncStatus,
} from "./rate-sources";
export { type FxRate, type FxRateInsert } from "./rates";
