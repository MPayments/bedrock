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
  "fee_revenue",
  "spread_revenue",
  "provider_fee_expense",
  "pass_through",
  "adjustment",
] as const;

export const CALCULATION_STATE_VALUES = [
  "draft",
  "offered",
  "accepted",
  "expired",
  "cancelled",
  "superseded",
] as const;

export const CALCULATION_LINE_SOURCE_KIND_VALUES = [
  "manual",
  "agreement",
  "quote",
  "provider",
  "system",
] as const;

export const CALCULATION_COMPONENT_CLASSIFICATION_VALUES = [
  "revenue",
  "expense",
  "pass_through",
  "adjustment",
] as const;

export const CALCULATION_COMPONENT_FORMULA_TYPE_VALUES = [
  "fixed",
  "bps",
  "per_million",
  "manual",
] as const;

export const CALCULATION_COMPONENT_BASIS_TYPE_VALUES = [
  "deal_source_amount",
  "deal_target_amount",
  "leg_from_amount",
  "leg_to_amount",
  "gross_revenue",
] as const;

export const CALCULATIONS_CREATE_IDEMPOTENCY_SCOPE = "calculations.create";
export const CALCULATIONS_CREATE_FOR_APPLICATION_IDEMPOTENCY_SCOPE =
  "calculations.create.application";

export type CalculationRateSource = (typeof CALCULATION_RATE_SOURCE_VALUES)[number];
export type CalculationLineKind = (typeof CALCULATION_LINE_KIND_VALUES)[number];
export type CalculationState = (typeof CALCULATION_STATE_VALUES)[number];
export type CalculationLineSourceKind =
  (typeof CALCULATION_LINE_SOURCE_KIND_VALUES)[number];
export type CalculationComponentClassification =
  (typeof CALCULATION_COMPONENT_CLASSIFICATION_VALUES)[number];
export type CalculationComponentFormulaType =
  (typeof CALCULATION_COMPONENT_FORMULA_TYPE_VALUES)[number];
export type CalculationComponentBasisType =
  (typeof CALCULATION_COMPONENT_BASIS_TYPE_VALUES)[number];
