import { z } from "zod";

import {
  EXTERNAL_RECORD_KINDS,
  EXECUTION_EVENT_KINDS,
  INSTRUCTION_STATUSES,
  SUBMISSION_CHANNELS,
} from "../../shared/domain/taxonomy";
import {
  dateInputSchema,
  jsonRecordSchema,
  positiveMinorAmountStringSchema,
  uuidSchema,
} from "../../shared/application/zod";

export const SubmissionChannelSchema = z.enum(SUBMISSION_CHANNELS);
export const InstructionStatusSchema = z.enum(INSTRUCTION_STATUSES);
export const ExecutionEventKindSchema = z.enum(EXECUTION_EVENT_KINDS);
export const ExternalRecordKindSchema = z.enum(EXTERNAL_RECORD_KINDS);

export const ExecutionInstructionSchema = z.object({
  id: uuidSchema,
  operationId: uuidSchema,
  sourceAccountId: uuidSchema,
  destinationEndpointId: uuidSchema.nullable(),
  submissionChannel: SubmissionChannelSchema,
  instructionStatus: InstructionStatusSchema,
  assetId: uuidSchema,
  amountMinor: positiveMinorAmountStringSchema,
  metadata: jsonRecordSchema.nullable(),
  createdAt: dateInputSchema,
  updatedAt: dateInputSchema,
});

export const CreateExecutionInstructionInputSchema = z.object({
  operationId: uuidSchema,
  sourceAccountId: uuidSchema.optional(),
  destinationEndpointId: uuidSchema.nullable().optional(),
  submissionChannel: SubmissionChannelSchema.default("manual"),
  assetId: uuidSchema.optional(),
  amountMinor: positiveMinorAmountStringSchema.optional(),
  metadata: jsonRecordSchema.nullable().optional(),
});

export const ListExecutionInstructionsInputSchema = z.object({
  operationId: uuidSchema.optional(),
  sourceAccountId: uuidSchema.optional(),
  assetId: uuidSchema.optional(),
  instructionStatus: InstructionStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const ExecutionEventSchema = z.object({
  id: uuidSchema,
  instructionId: uuidSchema,
  eventKind: ExecutionEventKindSchema,
  eventAt: dateInputSchema,
  externalRecordId: z.string().nullable(),
  metadata: jsonRecordSchema.nullable(),
  createdAt: dateInputSchema,
});

export const RecordExecutionEventInputSchema = z.object({
  instructionId: uuidSchema,
  eventKind: ExecutionEventKindSchema,
  eventAt: dateInputSchema.optional(),
  externalRecordId: z.string().nullable().optional(),
  metadata: jsonRecordSchema.nullable().optional(),
});

export const UnmatchedExternalRecordSchema = z.object({
  externalRecordId: uuidSchema,
  source: z.string().min(1),
  sourceRecordId: z.string().min(1),
  recordKind: ExternalRecordKindSchema.nullable(),
  receivedAt: dateInputSchema,
  reasonCode: z.string().min(1),
  reasonMeta: jsonRecordSchema.nullable(),
});

export const ListUnmatchedExternalRecordsInputSchema = z.object({
  sources: z.array(z.string().min(1)).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export type ExecutionInstruction = z.infer<typeof ExecutionInstructionSchema>;
export type CreateExecutionInstructionInput = z.infer<
  typeof CreateExecutionInstructionInputSchema
>;
export type ListExecutionInstructionsInput = z.infer<
  typeof ListExecutionInstructionsInputSchema
>;
export type ExecutionEvent = z.infer<typeof ExecutionEventSchema>;
export type RecordExecutionEventInput = z.infer<
  typeof RecordExecutionEventInputSchema
>;
export type UnmatchedExternalRecord = z.infer<
  typeof UnmatchedExternalRecordSchema
>;
export type ListUnmatchedExternalRecordsInput = z.infer<
  typeof ListUnmatchedExternalRecordsInputSchema
>;
