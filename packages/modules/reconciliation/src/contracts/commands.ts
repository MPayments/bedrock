import { z } from "zod";

export const CorrelationContextSchema = z
  .object({
    requestId: z.string().nullable().optional(),
    correlationId: z.string().nullable().optional(),
    traceId: z.string().nullable().optional(),
    causationId: z.string().nullable().optional(),
    actorId: z.string().nullable().optional(),
  })
  .optional();

export const ReconciliationPayloadSchema = z.record(z.string(), z.unknown());

export const ReconciliationExternalRecordInputSchema = z.object({
  source: z.string().min(1),
  sourceRecordId: z.string().min(1),
  rawPayload: ReconciliationPayloadSchema,
  normalizedPayload: ReconciliationPayloadSchema,
  normalizationVersion: z.number().int().positive(),
  actorUserId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1),
  requestContext: CorrelationContextSchema,
});

export const RunReconciliationInputSchema = z.object({
  source: z.string().min(1),
  rulesetChecksum: z.string().min(1),
  inputQuery: z.object({
    externalRecordIds: z.array(z.uuid()).optional(),
  }),
  actorUserId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1),
  requestContext: CorrelationContextSchema,
});

export const CreateAdjustmentDocumentInputSchema = z.object({
  exceptionId: z.uuid(),
  docType: z.string().min(1),
  payload: ReconciliationPayloadSchema,
  actorUserId: z.string().min(1),
  createIdempotencyKey: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1),
  requestContext: CorrelationContextSchema,
});

export type ReconciliationExternalRecordInput = z.infer<
  typeof ReconciliationExternalRecordInputSchema
>;
export type RunReconciliationInput = z.infer<
  typeof RunReconciliationInputSchema
>;
export type CreateAdjustmentDocumentInput = z.infer<
  typeof CreateAdjustmentDocumentInputSchema
>;
