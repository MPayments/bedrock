import { z } from "zod";

import { RECONCILIATION_EXCEPTION_STATES } from "../domain/exceptions";
import { RECONCILIATION_MATCH_STATUSES } from "../domain/matching";

export const ReconciliationExceptionStateSchema = z.enum(
  RECONCILIATION_EXCEPTION_STATES,
);

export const ReconciliationMatchStatusSchema = z.enum(
  RECONCILIATION_MATCH_STATUSES,
);

export const ListReconciliationExceptionsInputSchema = z.object({
  source: z.string().min(1).optional(),
  state: ReconciliationExceptionStateSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const ExplainReconciliationMatchInputSchema = z.object({
  matchId: z.string().min(1),
});

export type ListReconciliationExceptionsInput = z.infer<
  typeof ListReconciliationExceptionsInputSchema
>;
export type ExplainReconciliationMatchInput = z.infer<
  typeof ExplainReconciliationMatchInputSchema
>;
