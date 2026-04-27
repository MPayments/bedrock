import { feeRules } from "./fees/adapters/drizzle/schema";
import { paymentRouteTemplates } from "./payment-routes/adapters/drizzle/schema";
import {
  paymentStepArtifacts,
  paymentStepAttempts,
  paymentStepReturns,
  paymentSteps,
} from "./payment-steps/infra/drizzle/schema";
import {
  fxQuoteFeeComponents,
  fxQuoteFinancialLines,
  fxQuoteLegs,
  fxQuotes,
} from "./quotes/adapters/drizzle/schema";
import { fxRateSources, fxRates } from "./rates/adapters/drizzle/schema";
import {
  treasuryOrders,
  treasuryOrderSteps,
} from "./treasury-orders/infra/drizzle/schema";

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
  paymentStepReturns,
  paymentSteps,
  treasuryOrders,
  treasuryOrderSteps,
};

export const schema = {
  feeRules,
  fxQuoteFeeComponents,
  fxQuoteFinancialLines,
  fxQuoteLegs,
  fxQuotes,
  fxRates,
  fxRateSources,
  paymentRouteTemplates,
  paymentStepArtifacts,
  paymentStepAttempts,
  paymentStepReturns,
  paymentSteps,
  treasuryOrders,
  treasuryOrderSteps,
};
