import { z } from "zod";

import { RECONCILIATION_EXCEPTION_STATES } from "../domain/exceptions";

const ReconciliationExceptionStateSchema = z.enum(
  RECONCILIATION_EXCEPTION_STATES,
);

export const ListReconciliationExceptionsInputSchema = z.object({
  source: z.string().min(1).optional(),
  state: ReconciliationExceptionStateSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const ListReconciliationOperationLinksInputSchema = z.object({
  operationIds: z.array(z.string().min(1)).max(500).default([]),
});

export const ListPendingReconciliationExternalRecordIdsInputSchema = z
  .object({
    source: z.string().min(1),
    normalizedPayloadTextFilter: z
      .object({
        key: z.string().min(1),
        value: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ExplainReconciliationMatchInputSchema = z.object({
  matchId: z.string().min(1),
});

export type ListReconciliationExceptionsInput = z.infer<
  typeof ListReconciliationExceptionsInputSchema
>;
export type ListPendingReconciliationExternalRecordIdsInput = z.infer<
  typeof ListPendingReconciliationExternalRecordIdsInputSchema
>;
export type ListReconciliationOperationLinksInput = z.infer<
  typeof ListReconciliationOperationLinksInputSchema
>;
export type ExplainReconciliationMatchInput = z.infer<
  typeof ExplainReconciliationMatchInputSchema
>;
