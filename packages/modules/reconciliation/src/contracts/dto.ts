import { z } from "zod";

import { RECONCILIATION_EXCEPTION_STATES } from "../domain/exceptions";
import { RECONCILIATION_MATCH_STATUSES } from "../domain/matching";

const RecordShapeSchema = z.record(z.string(), z.unknown());
const StringIdSchema = z.string().min(1);

export const ReconciliationMatchStatusSchema = z.enum(
  RECONCILIATION_MATCH_STATUSES,
);
export const ReconciliationExceptionStateSchema = z.enum(
  RECONCILIATION_EXCEPTION_STATES,
);

export const ReconciliationMatchExplanationSchema = RecordShapeSchema;

export const ReconciliationRunSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
  ambiguous: z.number().int().nonnegative(),
});

export const ReconciliationExternalRecordDtoSchema = z.object({
  id: StringIdSchema,
  source: z.string().min(1),
  sourceRecordId: z.string().min(1),
  rawPayload: RecordShapeSchema,
  normalizedPayload: RecordShapeSchema,
  payloadHash: z.string().min(1),
  normalizationVersion: z.number().int().positive(),
  requestId: z.string().nullable(),
  correlationId: z.string().nullable(),
  traceId: z.string().nullable(),
  causationId: z.string().nullable(),
  receivedAt: z.date(),
});

export const ReconciliationRunDtoSchema = z.object({
  id: StringIdSchema,
  source: z.string().min(1),
  rulesetChecksum: z.string().min(1),
  inputQuery: RecordShapeSchema,
  resultSummary: ReconciliationRunSummarySchema,
  requestId: z.string().nullable(),
  correlationId: z.string().nullable(),
  traceId: z.string().nullable(),
  causationId: z.string().nullable(),
  createdAt: z.date(),
});

export const ReconciliationExceptionDtoSchema = z.object({
  id: StringIdSchema,
  runId: StringIdSchema,
  externalRecordId: StringIdSchema,
  adjustmentDocumentId: z.string().nullable(),
  reasonCode: z.string().min(1),
  reasonMeta: RecordShapeSchema.nullable(),
  state: ReconciliationExceptionStateSchema,
  createdAt: z.date(),
  resolvedAt: z.date().nullable(),
});

export const ReconciliationExceptionListItemDtoSchema = z.object({
  exception: ReconciliationExceptionDtoSchema,
  run: ReconciliationRunDtoSchema,
  externalRecord: ReconciliationExternalRecordDtoSchema,
});

export const ReconciliationOperationLinkExceptionDtoSchema = z.object({
  createdAt: z.date(),
  externalRecordId: StringIdSchema,
  id: StringIdSchema,
  operationId: StringIdSchema,
  reasonCode: z.string().min(1),
  resolvedAt: z.date().nullable(),
  source: z.string().min(1),
  state: ReconciliationExceptionStateSchema,
});

export const ReconciliationOperationLinkDtoSchema = z.object({
  exceptions: z.array(ReconciliationOperationLinkExceptionDtoSchema),
  lastActivityAt: z.date().nullable(),
  matchCount: z.number().int().nonnegative(),
  operationId: StringIdSchema,
});

export const CreateAdjustmentDocumentResultSchema = z.object({
  exceptionId: StringIdSchema,
  documentId: z.string().min(1),
});

export type ReconciliationMatchStatus = z.infer<
  typeof ReconciliationMatchStatusSchema
>;
export type ReconciliationExceptionState = z.infer<
  typeof ReconciliationExceptionStateSchema
>;
export type ReconciliationMatchExplanation = z.infer<
  typeof ReconciliationMatchExplanationSchema
>;
export type ReconciliationRunSummary = z.infer<
  typeof ReconciliationRunSummarySchema
>;
export type ReconciliationExternalRecordDto = z.infer<
  typeof ReconciliationExternalRecordDtoSchema
>;
export type ReconciliationRunDto = z.infer<typeof ReconciliationRunDtoSchema>;
export type ReconciliationExceptionDto = z.infer<
  typeof ReconciliationExceptionDtoSchema
>;
export type ReconciliationExceptionListItemDto = z.infer<
  typeof ReconciliationExceptionListItemDtoSchema
>;
export type ReconciliationOperationLinkExceptionDto = z.infer<
  typeof ReconciliationOperationLinkExceptionDtoSchema
>;
export type ReconciliationOperationLinkDto = z.infer<
  typeof ReconciliationOperationLinkDtoSchema
>;
export type CreateAdjustmentDocumentResult = z.infer<
  typeof CreateAdjustmentDocumentResultSchema
>;
