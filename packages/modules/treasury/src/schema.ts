import { feeRules } from "./fees/adapters/drizzle/schema";
import { paymentRouteTemplates } from "./payment-routes/adapters/drizzle/schema";
import {
  paymentStepArtifacts,
  paymentStepAttempts,
  paymentSteps,
} from "./payment-steps/infra/drizzle/schema";
import {
  fxQuoteFeeComponents,
  fxQuoteFinancialLines,
  fxQuoteLegs,
  fxQuotes,
} from "./quotes/adapters/drizzle/schema";
import { fxRateSources, fxRates } from "./rates/adapters/drizzle/schema";

export {
  feeRules,
  fxQuoteFeeComponents,
  fxQuoteFinancialLines,
  fxQuoteLegs,
  fxQuotes,
  fxRateSources,
  fxRates,
  paymentRouteTemplates,
  paymentStepArtifacts,
  paymentStepAttempts,
  paymentSteps,
};

export const schema = {
  fxQuotes,
  fxQuoteLegs,
  fxQuoteFeeComponents,
  fxQuoteFinancialLines,
  fxRates,
  fxRateSources,
  feeRules,
  paymentRouteTemplates,
  paymentStepArtifacts,
  paymentStepAttempts,
  paymentSteps,
};
