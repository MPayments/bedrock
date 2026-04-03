import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type { TreasuryInstructionState } from "../contracts/zod";

export interface TreasuryInstructionRecord {
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
  state: TreasuryInstructionState;
  submittedAt: Date | null;
  updatedAt: Date;
  voidedAt: Date | null;
}

export interface TreasuryInstructionWriteModel {
  attempt: number;
  failedAt?: Date | null;
  id: string;
  operationId: string;
  providerRef?: string | null;
  providerSnapshot?: Record<string, unknown> | null;
  returnRequestedAt?: Date | null;
  returnedAt?: Date | null;
  settledAt?: Date | null;
  sourceRef: string;
  state: TreasuryInstructionState;
  submittedAt?: Date | null;
  voidedAt?: Date | null;
}

export interface TreasuryInstructionUpdateModel {
  failedAt?: Date | null;
  id: string;
  providerRef?: string | null;
  providerSnapshot?: Record<string, unknown> | null;
  returnRequestedAt?: Date | null;
  returnedAt?: Date | null;
  settledAt?: Date | null;
  state: TreasuryInstructionState;
  submittedAt?: Date | null;
  voidedAt?: Date | null;
}

export interface TreasuryInstructionsRepository {
  findInstructionById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionRecord | undefined>;
  findInstructionBySourceRef(
    sourceRef: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionRecord | undefined>;
  findLatestInstructionByOperationId(
    operationId: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionRecord | undefined>;
  insertInstruction(
    input: TreasuryInstructionWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionRecord | null>;
  listLatestInstructionsByOperationIds(
    operationIds: string[],
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionRecord[]>;
  updateInstruction(
    input: TreasuryInstructionUpdateModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryInstructionRecord | undefined>;
}
