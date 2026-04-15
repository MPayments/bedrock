import { feeRules } from "./fees/adapters/drizzle/schema";
import { treasuryInstructions } from "./instructions/adapters/drizzle/schema";
import {
  treasuryCashMovements,
  treasuryExecutionFees,
  treasuryExecutionFills,
  treasuryOperations,
} from "./operations/adapters/drizzle/schema";
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
  treasuryInstructions,
  treasuryCashMovements,
  treasuryExecutionFees,
  treasuryExecutionFills,
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
  treasuryInstructions,
  treasuryCashMovements,
  treasuryExecutionFees,
  treasuryExecutionFills,
  treasuryOperations,
};
