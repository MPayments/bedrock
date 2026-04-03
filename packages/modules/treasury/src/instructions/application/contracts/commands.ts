import { z } from "zod";

import { TreasuryInstructionOutcomeSchema } from "./zod";

const OptionalJsonRecordSchema = z
  .record(z.string(), z.unknown())
  .nullable()
  .optional()
  .default(null);
const OptionalProviderRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .nullable()
  .optional()
  .default(null);

export const PrepareTreasuryInstructionInputSchema = z.object({
  id: z.uuid(),
  operationId: z.uuid(),
  providerRef: OptionalProviderRefSchema,
  providerSnapshot: OptionalJsonRecordSchema,
  sourceRef: z.string().trim().min(1).max(255),
});

export const SubmitTreasuryInstructionInputSchema = z.object({
  instructionId: z.uuid(),
  providerRef: OptionalProviderRefSchema,
  providerSnapshot: OptionalJsonRecordSchema,
});

export const RetryTreasuryInstructionInputSchema = z.object({
  id: z.uuid(),
  operationId: z.uuid(),
  providerRef: OptionalProviderRefSchema,
  providerSnapshot: OptionalJsonRecordSchema,
  sourceRef: z.string().trim().min(1).max(255),
});

export const VoidTreasuryInstructionInputSchema = z.object({
  instructionId: z.uuid(),
  providerRef: OptionalProviderRefSchema,
  providerSnapshot: OptionalJsonRecordSchema,
});

export const RequestTreasuryReturnInputSchema = z.object({
  instructionId: z.uuid(),
  providerRef: OptionalProviderRefSchema,
  providerSnapshot: OptionalJsonRecordSchema,
});

export const RecordTreasuryInstructionOutcomeInputSchema = z.object({
  instructionId: z.uuid(),
  outcome: TreasuryInstructionOutcomeSchema,
  providerRef: OptionalProviderRefSchema,
  providerSnapshot: OptionalJsonRecordSchema,
});

export type PrepareTreasuryInstructionInput = z.infer<
  typeof PrepareTreasuryInstructionInputSchema
>;
export type SubmitTreasuryInstructionInput = z.infer<
  typeof SubmitTreasuryInstructionInputSchema
>;
export type RetryTreasuryInstructionInput = z.infer<
  typeof RetryTreasuryInstructionInputSchema
>;
export type VoidTreasuryInstructionInput = z.infer<
  typeof VoidTreasuryInstructionInputSchema
>;
export type RequestTreasuryReturnInput = z.infer<
  typeof RequestTreasuryReturnInputSchema
>;
export type RecordTreasuryInstructionOutcomeInput = z.infer<
  typeof RecordTreasuryInstructionOutcomeInputSchema
>;
