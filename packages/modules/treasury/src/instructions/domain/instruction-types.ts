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

export const TREASURY_INSTRUCTION_ARTIFACT_PURPOSE_VALUES = [
  "submission_confirmation",
  "bank_confirmation",
  "counterparty_receipt",
  "settlement_confirmation",
  "exception_note",
] as const;

export const TREASURY_INSTRUCTION_SETTLEMENT_EVIDENCE_PURPOSES = [
  "bank_confirmation",
  "settlement_confirmation",
  "counterparty_receipt",
] as const;

export type TreasuryInstructionState =
  (typeof TREASURY_INSTRUCTION_STATE_VALUES)[number];
export type TreasuryInstructionOutcome =
  (typeof TREASURY_INSTRUCTION_OUTCOME_VALUES)[number];
export type TreasuryInstructionArtifactPurpose =
  (typeof TREASURY_INSTRUCTION_ARTIFACT_PURPOSE_VALUES)[number];
