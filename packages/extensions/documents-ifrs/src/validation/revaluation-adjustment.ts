import type { z } from "zod";

import {
  AccrualAdjustmentInputSchema,
  AccrualAdjustmentSchema,
} from "./accrual-adjustment";

export const RevaluationAdjustmentInputSchema = AccrualAdjustmentInputSchema;

export const RevaluationAdjustmentSchema = AccrualAdjustmentSchema;

export type RevaluationAdjustmentInput = z.infer<
  typeof RevaluationAdjustmentInputSchema
>;
export type RevaluationAdjustment = z.infer<typeof RevaluationAdjustmentSchema>;
