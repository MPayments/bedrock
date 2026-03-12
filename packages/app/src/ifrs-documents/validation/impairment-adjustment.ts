import type { z } from "zod";

import {
  AccrualAdjustmentInputSchema,
  AccrualAdjustmentSchema,
} from "./accrual-adjustment";

export const ImpairmentAdjustmentInputSchema = AccrualAdjustmentInputSchema;

export const ImpairmentAdjustmentSchema = AccrualAdjustmentSchema;

export type ImpairmentAdjustmentInput = z.infer<
  typeof ImpairmentAdjustmentInputSchema
>;
export type ImpairmentAdjustment = z.infer<typeof ImpairmentAdjustmentSchema>;
