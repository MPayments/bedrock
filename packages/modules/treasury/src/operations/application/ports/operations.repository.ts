import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  TreasuryOperationFactSourceKind,
  TreasuryOperationKind,
  TreasuryOperationState,
} from "../contracts/zod";

export interface TreasuryOperationRecord {
  amountMinor: bigint | null;
  counterAmountMinor: bigint | null;
  counterCurrencyId: string | null;
  createdAt: Date;
  currencyId: string | null;
  customerId: string | null;
  dealId: string | null;
  id: string;
  internalEntityOrganizationId: string | null;
  kind: TreasuryOperationKind;
  quoteId: string | null;
  routeLegId: string | null;
  sourceRef: string;
  state: TreasuryOperationState;
  updatedAt: Date;
}

export interface TreasuryOperationWriteModel {
  amountMinor: bigint | null;
  counterAmountMinor: bigint | null;
  counterCurrencyId: string | null;
  currencyId: string | null;
  customerId: string | null;
  dealId: string;
  id: string;
  internalEntityOrganizationId: string | null;
  kind: TreasuryOperationKind;
  quoteId: string | null;
  routeLegId: string | null;
  sourceRef: string;
  state: TreasuryOperationState;
}

export interface TreasuryOperationsListQuery {
  dealId?: string;
  internalEntityOrganizationId?: string;
  kind?: TreasuryOperationKind[];
  limit: number;
  offset: number;
  sortBy?: "createdAt" | "kind";
  sortOrder?: "asc" | "desc";
}

export interface TreasuryOperationsRepository {
  findOperationById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryOperationRecord | undefined>;
  findOperationBySourceRef(
    sourceRef: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryOperationRecord | undefined>;
  insertOperation(
    input: TreasuryOperationWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryOperationRecord | null>;
  listOperations(
    input: TreasuryOperationsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryOperationRecord[]; total: number }>;
}

export type TreasuryExecutionActualSourceKind = TreasuryOperationFactSourceKind;
export type TreasuryCashMovementDirection = "credit" | "debit";

export interface TreasuryExecutionFillRecord {
  actualRateDen: bigint | null;
  actualRateNum: bigint | null;
  boughtAmountMinor: bigint | null;
  boughtCurrencyId: string | null;
  calculationSnapshotId: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  dealId: string | null;
  executedAt: Date;
  externalRecordId: string | null;
  fillSequence: number | null;
  id: string;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  soldAmountMinor: bigint | null;
  soldCurrencyId: string | null;
  sourceKind: TreasuryExecutionActualSourceKind;
  sourceRef: string;
  updatedAt: Date;
}

export interface TreasuryExecutionFillWriteModel {
  actualRateDen: bigint | null;
  actualRateNum: bigint | null;
  boughtAmountMinor: bigint | null;
  boughtCurrencyId: string | null;
  calculationSnapshotId: string | null;
  confirmedAt: Date | null;
  dealId: string | null;
  executedAt: Date;
  externalRecordId: string | null;
  fillSequence: number | null;
  id: string;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  soldAmountMinor: bigint | null;
  soldCurrencyId: string | null;
  sourceKind: TreasuryExecutionActualSourceKind;
  sourceRef: string;
}

export interface TreasuryExecutionFillListQuery {
  dealId?: string;
  limit: number;
  offset: number;
  operationId?: string;
  routeLegId?: string;
  sortBy?: "createdAt" | "executedAt";
  sortOrder?: "asc" | "desc";
  sourceKind?: TreasuryExecutionActualSourceKind[];
}

export interface TreasuryExecutionFillsRepository {
  findFillBySourceRef(
    sourceRef: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryExecutionFillRecord | undefined>;
  insertFill(
    input: TreasuryExecutionFillWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryExecutionFillRecord | null>;
  listFills(
    input: TreasuryExecutionFillListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryExecutionFillRecord[]; total: number }>;
}

export interface TreasuryExecutionFeeRecord {
  amountMinor: bigint | null;
  calculationSnapshotId: string | null;
  chargedAt: Date;
  componentCode: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  currencyId: string | null;
  dealId: string | null;
  externalRecordId: string | null;
  feeFamily: string;
  fillId: string | null;
  id: string;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  routeComponentId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceKind: TreasuryExecutionActualSourceKind;
  sourceRef: string;
  updatedAt: Date;
}

export interface TreasuryExecutionFeeWriteModel {
  amountMinor: bigint | null;
  calculationSnapshotId: string | null;
  chargedAt: Date;
  componentCode: string | null;
  confirmedAt: Date | null;
  currencyId: string | null;
  dealId: string | null;
  externalRecordId: string | null;
  feeFamily: string;
  fillId: string | null;
  id: string;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  routeComponentId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceKind: TreasuryExecutionActualSourceKind;
  sourceRef: string;
}

export interface TreasuryExecutionFeeListQuery {
  dealId?: string;
  limit: number;
  offset: number;
  operationId?: string;
  routeLegId?: string;
  sortBy?: "chargedAt" | "createdAt";
  sortOrder?: "asc" | "desc";
  sourceKind?: TreasuryExecutionActualSourceKind[];
}

export interface TreasuryExecutionFeesRepository {
  findFeeBySourceRef(
    sourceRef: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryExecutionFeeRecord | undefined>;
  insertFee(
    input: TreasuryExecutionFeeWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryExecutionFeeRecord | null>;
  listFees(
    input: TreasuryExecutionFeeListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryExecutionFeeRecord[]; total: number }>;
}

export interface TreasuryCashMovementRecord {
  accountRef: string | null;
  amountMinor: bigint | null;
  bookedAt: Date;
  calculationSnapshotId: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  currencyId: string | null;
  dealId: string | null;
  direction: TreasuryCashMovementDirection;
  externalRecordId: string | null;
  id: string;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  requisiteId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceKind: TreasuryExecutionActualSourceKind;
  sourceRef: string;
  statementRef: string | null;
  updatedAt: Date;
  valueDate: Date | null;
}

export interface TreasuryCashMovementWriteModel {
  accountRef: string | null;
  amountMinor: bigint | null;
  bookedAt: Date;
  calculationSnapshotId: string | null;
  confirmedAt: Date | null;
  currencyId: string | null;
  dealId: string | null;
  direction: TreasuryCashMovementDirection;
  externalRecordId: string | null;
  id: string;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerCounterpartyId: string | null;
  providerRef: string | null;
  requisiteId: string | null;
  routeLegId: string | null;
  routeVersionId: string | null;
  sourceKind: TreasuryExecutionActualSourceKind;
  sourceRef: string;
  statementRef: string | null;
  valueDate: Date | null;
}

export interface TreasuryCashMovementListQuery {
  dealId?: string;
  limit: number;
  offset: number;
  operationId?: string;
  routeLegId?: string;
  sortBy?: "bookedAt" | "createdAt";
  sortOrder?: "asc" | "desc";
  sourceKind?: TreasuryExecutionActualSourceKind[];
}

export interface TreasuryCashMovementsRepository {
  findCashMovementBySourceRef(
    sourceRef: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryCashMovementRecord | undefined>;
  insertCashMovement(
    input: TreasuryCashMovementWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryCashMovementRecord | null>;
  listCashMovements(
    input: TreasuryCashMovementListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryCashMovementRecord[]; total: number }>;
}
