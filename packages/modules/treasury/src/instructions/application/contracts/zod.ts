import { z } from "zod";

import {
  TREASURY_INSTRUCTION_OUTCOME_VALUES,
  TREASURY_INSTRUCTION_STATE_VALUES,
} from "../../domain/instruction-types";

export const TreasuryInstructionStateSchema = z.enum(
  TREASURY_INSTRUCTION_STATE_VALUES,
);
export type TreasuryInstructionState = z.infer<
  typeof TreasuryInstructionStateSchema
>;

export const TreasuryInstructionOutcomeSchema = z.enum(
  TREASURY_INSTRUCTION_OUTCOME_VALUES,
);
export type TreasuryInstructionOutcome = z.infer<
  typeof TreasuryInstructionOutcomeSchema
>;
