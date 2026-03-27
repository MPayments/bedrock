import { z } from "zod";

import { ALLOCATION_TYPES } from "../../shared/domain/taxonomy";
import {
  dateInputSchema,
  positiveMinorAmountStringSchema,
  uuidSchema,
} from "../../shared/application/zod";

export const AllocationTypeSchema = z.enum(ALLOCATION_TYPES);

export const AllocationSchema = z.object({
  id: uuidSchema,
  obligationId: uuidSchema,
  executionEventId: uuidSchema,
  allocatedMinor: positiveMinorAmountStringSchema,
  allocationType: AllocationTypeSchema,
  createdAt: dateInputSchema,
});

export const AllocateExecutionInputSchema = z.object({
  obligationId: uuidSchema,
  executionEventId: uuidSchema,
  allocatedMinor: positiveMinorAmountStringSchema,
  allocationType: AllocationTypeSchema.default("principal"),
});

export type Allocation = z.infer<typeof AllocationSchema>;
export type AllocateExecutionInput = z.infer<typeof AllocateExecutionInputSchema>;
