import { z } from "zod";

import {
  TreasuryInstructionOutcomeSchema,
  TreasuryInstructionStateSchema,
} from "./zod";

const JsonRecordSchema = z.record(z.string(), z.unknown());

export const TreasuryInstructionSchema = z.object({
  attempt: z.number().int().positive(),
  createdAt: z.date(),
  failedAt: z.date().nullable(),
  id: z.uuid(),
  operationId: z.uuid(),
  providerRef: z.string().nullable(),
  providerSnapshot: JsonRecordSchema.nullable(),
  returnRequestedAt: z.date().nullable(),
  returnedAt: z.date().nullable(),
  settledAt: z.date().nullable(),
  sourceRef: z.string(),
  state: TreasuryInstructionStateSchema,
  submittedAt: z.date().nullable(),
  updatedAt: z.date(),
  voidedAt: z.date().nullable(),
});

export const TreasuryInstructionActionsSchema = z.object({
  canPrepareInstruction: z.boolean(),
  canRequestReturn: z.boolean(),
  canRetryInstruction: z.boolean(),
  canSubmitInstruction: z.boolean(),
  canVoidInstruction: z.boolean(),
});

export const TreasuryInstructionAvailableOutcomeTransitionsSchema = z.array(
  TreasuryInstructionOutcomeSchema,
);

export type TreasuryInstruction = z.infer<typeof TreasuryInstructionSchema>;
export type TreasuryInstructionActions = z.infer<
  typeof TreasuryInstructionActionsSchema
>;
export type TreasuryInstructionAvailableOutcomeTransitions = z.infer<
  typeof TreasuryInstructionAvailableOutcomeTransitionsSchema
>;
