import type { z } from "zod";

import {
  AccrualAdjustmentInputSchema,
  AccrualAdjustmentSchema,
} from "./accrual-adjustment";

export const ClosingReclassInputSchema = AccrualAdjustmentInputSchema;

export const ClosingReclassSchema = AccrualAdjustmentSchema;

export type ClosingReclassInput = z.infer<typeof ClosingReclassInputSchema>;
export type ClosingReclass = z.infer<typeof ClosingReclassSchema>;
