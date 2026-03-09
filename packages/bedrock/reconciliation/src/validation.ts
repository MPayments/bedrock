import { z } from "zod";

export const ReconciliationExternalRecordInputSchema = z.object({
  source: z.string().min(1),
  sourceRecordId: z.string().min(1),
  rawPayload: z.record(z.string(), z.unknown()),
  normalizedPayload: z.record(z.string(), z.unknown()),
  normalizationVersion: z.number().int().positive(),
  actorUserId: z.string().min(1).optional(),
});

export const RunReconciliationInputSchema = z.object({
  source: z.string().min(1),
  rulesetChecksum: z.string().min(1),
  inputQuery: z.object({
    externalRecordIds: z.array(z.uuid()).optional(),
  }),
  actorUserId: z.string().min(1).optional(),
});

export const ListReconciliationExceptionsInputSchema = z.object({
  source: z.string().min(1).optional(),
  state: z.enum(["open", "resolved", "ignored"]).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const CreateAdjustmentDocumentInputSchema = z.object({
  exceptionId: z.uuid(),
  docType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  actorUserId: z.string().min(1),
  createIdempotencyKey: z.string().min(1).optional(),
});

export type ReconciliationExternalRecordInput = z.infer<
  typeof ReconciliationExternalRecordInputSchema
>;
export type RunReconciliationInput = z.infer<
  typeof RunReconciliationInputSchema
>;
export type ListReconciliationExceptionsInput = z.infer<
  typeof ListReconciliationExceptionsInputSchema
>;
export type CreateAdjustmentDocumentInput = z.infer<
  typeof CreateAdjustmentDocumentInputSchema
>;

export function validateReconciliationExternalRecordInput(input: unknown) {
  return ReconciliationExternalRecordInputSchema.parse(input);
}

export function validateRunReconciliationInput(input: unknown) {
  return RunReconciliationInputSchema.parse(input);
}

export function validateListReconciliationExceptionsInput(input: unknown) {
  return ListReconciliationExceptionsInputSchema.parse(input);
}

export function validateCreateAdjustmentDocumentInput(input: unknown) {
  return CreateAdjustmentDocumentInputSchema.parse(input);
}
