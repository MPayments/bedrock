import type { BalanceMutationResult, BalanceSubjectInput } from "../../contracts";
import type { BalanceEventInput } from "../../domain/balance-events";
import type {
  BalanceHoldRecord,
  BalanceHoldUpdate,
} from "../../domain/balance-hold";
import type {
  BalancePositionDelta,
  BalanceSnapshot,
} from "../../domain/balance-position";

export interface BalancesStateRepository {
  getBalancePosition(subject: BalanceSubjectInput): Promise<BalanceSnapshot | null>;
  getBalancePositionForUpdate(
    subject: BalanceSubjectInput,
  ): Promise<BalanceSnapshot | null>;
  ensureBalancePosition(subject: BalanceSubjectInput): Promise<BalanceSnapshot>;
  updateBalancePosition(input: {
    subject: BalanceSubjectInput;
    delta: BalancePositionDelta;
  }): Promise<BalanceSnapshot>;
  getHold(
    subject: BalanceSubjectInput,
    holdRef: string,
  ): Promise<BalanceHoldRecord | null>;
  getHoldForUpdate(
    subject: BalanceSubjectInput,
    holdRef: string,
  ): Promise<BalanceHoldRecord | null>;
  createHold(input: {
    subject: BalanceSubjectInput;
    holdRef: string;
    amountMinor: bigint;
    state: BalanceHoldRecord["state"];
    reason?: string | null;
    actorId?: string | null;
    requestContext?: BalanceEventInput["requestContext"];
  }): Promise<BalanceHoldRecord>;
  updateHold(holdId: string, update: BalanceHoldUpdate): Promise<BalanceHoldRecord>;
  appendBalanceEvent(input: BalanceEventInput): Promise<void>;
  loadMutationReplayResult(
    subject: BalanceSubjectInput,
    holdRef?: string | null,
  ): Promise<BalanceMutationResult>;
}
