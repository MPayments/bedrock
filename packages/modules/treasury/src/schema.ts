import { feeRules } from "./fees/adapters/drizzle/schema";
import { fxQuoteFeeComponents } from "./quotes/adapters/drizzle/schema/quote-fee-components";
import { fxQuoteFinancialLines } from "./quotes/adapters/drizzle/schema/quote-financial-lines";
import { fxQuoteLegs } from "./quotes/adapters/drizzle/schema/quote-legs";
import { fxQuotes } from "./quotes/adapters/drizzle/schema/quotes";
import { fxRateSources } from "./rates/adapters/drizzle/schema/rate-sources";
import { fxRates } from "./rates/adapters/drizzle/schema/rates";

export {
  feeRules,
  fxQuoteFeeComponents,
  fxQuoteFinancialLines,
  fxQuoteLegs,
  fxQuotes,
  fxRateSources,
  fxRates,
};

export const schema = {
  fxQuotes,
  fxQuoteLegs,
  fxQuoteFeeComponents,
  fxQuoteFinancialLines,
  fxRates,
  fxRateSources,
  feeRules,
};
