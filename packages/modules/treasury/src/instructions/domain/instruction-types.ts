export const TREASURY_INSTRUCTION_STATE_VALUES = [
  "prepared",
  "submitted",
  "settled",
  "failed",
  "voided",
  "return_requested",
  "returned",
] as const;

export const TREASURY_INSTRUCTION_OUTCOME_VALUES = [
  "settled",
  "failed",
  "returned",
] as const;

export type TreasuryInstructionState =
  (typeof TREASURY_INSTRUCTION_STATE_VALUES)[number];
export type TreasuryInstructionOutcome =
  (typeof TREASURY_INSTRUCTION_OUTCOME_VALUES)[number];
