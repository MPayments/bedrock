import { feeRules } from "./fees/adapters/drizzle/schema";
import {
  treasuryInstructionArtifacts,
  treasuryInstructions,
} from "./instructions/adapters/drizzle/schema";
import { treasuryOperations } from "./operations/adapters/drizzle/schema";
import { paymentRouteTemplates } from "./payment-routes/adapters/drizzle/schema";
import {
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
  paymentStepAttempts,
  paymentSteps,
  treasuryInstructionArtifacts,
  treasuryInstructions,
  treasuryOperations,
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
  paymentStepAttempts,
  paymentSteps,
  treasuryInstructionArtifacts,
  treasuryInstructions,
  treasuryOperations,
};
