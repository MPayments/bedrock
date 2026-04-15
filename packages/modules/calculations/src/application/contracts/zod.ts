import { z } from "zod";

import {
  CALCULATION_COMPONENT_BASIS_TYPE_VALUES,
  CALCULATION_COMPONENT_CLASSIFICATION_VALUES,
  CALCULATION_COMPONENT_FORMULA_TYPE_VALUES,
  CALCULATION_LINE_KIND_VALUES,
  CALCULATION_LINE_SOURCE_KIND_VALUES,
  CALCULATION_RATE_SOURCE_VALUES,
  CALCULATION_STATE_VALUES,
} from "../../domain/constants";

export const CalculationRateSourceSchema = z.enum(
  CALCULATION_RATE_SOURCE_VALUES,
);
export const CalculationLineKindSchema = z.enum(CALCULATION_LINE_KIND_VALUES);
export const CalculationStateSchema = z.enum(CALCULATION_STATE_VALUES);
export const CalculationLineSourceKindSchema = z.enum(
  CALCULATION_LINE_SOURCE_KIND_VALUES,
);
export const CalculationComponentClassificationSchema = z.enum(
  CALCULATION_COMPONENT_CLASSIFICATION_VALUES,
);
export const CalculationComponentFormulaTypeSchema = z.enum(
  CALCULATION_COMPONENT_FORMULA_TYPE_VALUES,
);
export const CalculationComponentBasisTypeSchema = z.enum(
  CALCULATION_COMPONENT_BASIS_TYPE_VALUES,
);

export type CalculationRateSource = z.infer<typeof CalculationRateSourceSchema>;
export type CalculationLineKind = z.infer<typeof CalculationLineKindSchema>;
export type CalculationState = z.infer<typeof CalculationStateSchema>;
export type CalculationLineSourceKind = z.infer<
  typeof CalculationLineSourceKindSchema
>;
export type CalculationComponentClassification = z.infer<
  typeof CalculationComponentClassificationSchema
>;
export type CalculationComponentFormulaType = z.infer<
  typeof CalculationComponentFormulaTypeSchema
>;
export type CalculationComponentBasisType = z.infer<
  typeof CalculationComponentBasisTypeSchema
>;
