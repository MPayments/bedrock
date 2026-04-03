import { z } from "zod";

import {
  CALCULATION_LINE_KIND_VALUES,
  CALCULATION_RATE_SOURCE_VALUES,
} from "../../domain/constants";

export const CalculationRateSourceSchema = z.enum(
  CALCULATION_RATE_SOURCE_VALUES,
);
export const CalculationLineKindSchema = z.enum(CALCULATION_LINE_KIND_VALUES);

export type CalculationRateSource = z.infer<typeof CalculationRateSourceSchema>;
export type CalculationLineKind = z.infer<typeof CalculationLineKindSchema>;
