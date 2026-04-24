import { z } from "zod";

import {
  PaymentStepPurposeSchema,
  PaymentStepStateSchema,
} from "../../contracts/dto";

export const GetPaymentStepByIdInputSchema = z.object({
  stepId: z.uuid(),
});

export const ListPaymentStepsQuerySchema = z.object({
  batchId: z.uuid().optional(),
  dealId: z.uuid().optional(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
  purpose: PaymentStepPurposeSchema.optional(),
  state: z.array(PaymentStepStateSchema).optional(),
});

export type GetPaymentStepByIdInput = z.infer<
  typeof GetPaymentStepByIdInputSchema
>;
export type ListPaymentStepsQuery = z.infer<typeof ListPaymentStepsQuerySchema>;
