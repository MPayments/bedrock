import { z } from "zod";

import {
  TreasuryInstructionOutcomeSchema,
  TreasuryInstructionStateSchema,
} from "./zod";

const JsonRecordSchema = z.record(z.string(), z.unknown());

export const TreasuryInstructionSchema = z.object({
  attempt: z.number().int().positive(),
  createdAt: z.coerce.date(),
  failedAt: z.coerce.date().nullable(),
  id: z.uuid(),
  operationId: z.uuid(),
  providerRef: z.string().nullable(),
  providerSnapshot: JsonRecordSchema.nullable(),
  returnRequestedAt: z.coerce.date().nullable(),
  returnedAt: z.coerce.date().nullable(),
  settledAt: z.coerce.date().nullable(),
  sourceRef: z.string(),
  state: TreasuryInstructionStateSchema,
  submittedAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
  voidedAt: z.coerce.date().nullable(),
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
