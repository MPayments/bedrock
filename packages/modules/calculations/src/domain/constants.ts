export const CALCULATION_RATE_SOURCE_VALUES = [
  "cbr",
  "investing",
  "xe",
  "manual",
  "fx_quote",
] as const;

export const CALCULATION_LINE_KIND_VALUES = [
  "original_amount",
  "fee_amount",
  "total_amount",
  "additional_expenses",
  "fee_amount_in_base",
  "total_in_base",
  "additional_expenses_in_base",
  "total_with_expenses_in_base",
] as const;

export const CALCULATIONS_CREATE_IDEMPOTENCY_SCOPE = "calculations.create";
export const CALCULATIONS_CREATE_FOR_APPLICATION_IDEMPOTENCY_SCOPE =
  "calculations.create.application";

export type CalculationRateSource = (typeof CALCULATION_RATE_SOURCE_VALUES)[number];
export type CalculationLineKind = (typeof CALCULATION_LINE_KIND_VALUES)[number];
