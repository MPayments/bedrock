import type {
  BalanceMutationResult,
  BalanceSubjectInput,
  LiquidityQueryRow,
  ListOrganizationLiquidityRowsInput,
} from "../contracts";
import type { BalanceEventInput } from "../domain/balance-events";
import type {
  BalanceHoldRecord,
  BalanceHoldSnapshot,
  BalanceHoldUpdate,
} from "../domain/balance-hold";
import type {
  BalancePositionDelta,
  BalanceSnapshot,
} from "../domain/balance-position";
import type {
  BalanceProjectorCursor,
  ProjectedBalanceDelta,
  ProjectionOperationRow,
  ProjectionPostingRow,
} from "../domain/projection";

export interface BalancesStatePort {
  getBalancePosition: (
    subject: BalanceSubjectInput,
  ) => Promise<BalanceSnapshot | null>;
  getBalancePositionForUpdate: (
    subject: BalanceSubjectInput,
  ) => Promise<BalanceSnapshot | null>;
  ensureBalancePosition: (
    subject: BalanceSubjectInput,
  ) => Promise<BalanceSnapshot>;
  updateBalancePosition: (input: {
    subject: BalanceSubjectInput;
    delta: BalancePositionDelta;
  }) => Promise<BalanceSnapshot>;
  getHold: (
    subject: BalanceSubjectInput,
    holdRef: string,
  ) => Promise<BalanceHoldRecord | null>;
  getHoldForUpdate: (
    subject: BalanceSubjectInput,
    holdRef: string,
  ) => Promise<BalanceHoldRecord | null>;
  createHold: (input: {
    subject: BalanceSubjectInput;
    holdRef: string;
    amountMinor: bigint;
    state: BalanceHoldRecord["state"];
    reason?: string | null;
    actorId?: string | null;
    requestContext?: BalanceEventInput["requestContext"];
  }) => Promise<BalanceHoldRecord>;
  updateHold: (
    holdId: string,
    update: BalanceHoldUpdate,
  ) => Promise<BalanceHoldRecord>;
  appendBalanceEvent: (input: BalanceEventInput) => Promise<void>;
  loadMutationReplayResult: (
    subject: BalanceSubjectInput,
    holdRef?: string | null,
  ) => Promise<BalanceMutationResult>;
}

export interface BalancesReportingPort {
  listOrganizationLiquidityRows: (
    input: ListOrganizationLiquidityRowsInput,
  ) => Promise<LiquidityQueryRow[]>;
}

export interface BalancesProjectionPort {
  ensureCursor: () => Promise<BalanceProjectorCursor>;
  listOperationsAfterCursor: (
    cursor: BalanceProjectorCursor,
    batchSize: number,
  ) => Promise<ProjectionOperationRow[]>;
  listProjectionPostingRows: (
    operation: ProjectionOperationRow,
  ) => Promise<ProjectionPostingRow[]>;
  applyProjectedDelta: (
    input: ProjectedBalanceDelta & {
      operationId: string;
      sourceType: string;
      sourceId: string;
      operationCode: string;
      postedAt: Date;
    },
  ) => Promise<boolean>;
  advanceCursor: (input: {
    postedAt: Date;
    operationId: string;
  }) => Promise<void>;
}
