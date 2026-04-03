import type { TreasuryInstruction } from "./contracts/dto";

type TreasuryInstructionLike = {
  attempt: number;
  createdAt: Date;
  failedAt: Date | null;
  id: string;
  operationId: string;
  providerRef: string | null;
  providerSnapshot: Record<string, unknown> | null;
  returnRequestedAt: Date | null;
  returnedAt: Date | null;
  settledAt: Date | null;
  sourceRef: string;
  state: TreasuryInstruction["state"];
  submittedAt: Date | null;
  updatedAt: Date;
  voidedAt: Date | null;
};

export function mapTreasuryInstruction(
  input: TreasuryInstructionLike,
): TreasuryInstruction {
  return {
    attempt: input.attempt,
    createdAt: input.createdAt,
    failedAt: input.failedAt,
    id: input.id,
    operationId: input.operationId,
    providerRef: input.providerRef,
    providerSnapshot: input.providerSnapshot,
    returnRequestedAt: input.returnRequestedAt,
    returnedAt: input.returnedAt,
    settledAt: input.settledAt,
    sourceRef: input.sourceRef,
    state: input.state,
    submittedAt: input.submittedAt,
    updatedAt: input.updatedAt,
    voidedAt: input.voidedAt,
  };
}
