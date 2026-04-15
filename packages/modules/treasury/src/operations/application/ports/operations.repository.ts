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

export interface TreasuryOperationFactRecord {
  amountMinor: bigint | null;
  confirmedAt: Date | null;
  counterAmountMinor: bigint | null;
  counterCurrencyId: string | null;
  createdAt: Date;
  currencyId: string | null;
  dealId: string | null;
  externalRecordId: string | null;
  feeAmountMinor: bigint | null;
  feeCurrencyId: string | null;
  id: string;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerRef: string | null;
  recordedAt: Date;
  routeLegId: string | null;
  sourceKind: TreasuryOperationFactSourceKind;
  sourceRef: string;
  updatedAt: Date;
}

export interface TreasuryOperationFactWriteModel {
  amountMinor: bigint | null;
  confirmedAt: Date | null;
  counterAmountMinor: bigint | null;
  counterCurrencyId: string | null;
  currencyId: string | null;
  dealId: string | null;
  externalRecordId: string | null;
  feeAmountMinor: bigint | null;
  feeCurrencyId: string | null;
  id: string;
  instructionId: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  operationId: string;
  providerRef: string | null;
  recordedAt: Date;
  routeLegId: string | null;
  sourceKind: TreasuryOperationFactSourceKind;
  sourceRef: string;
}

export interface TreasuryOperationFactsListQuery {
  dealId?: string;
  limit: number;
  offset: number;
  operationId?: string;
  routeLegId?: string;
  sortBy?: "createdAt" | "recordedAt";
  sortOrder?: "asc" | "desc";
  sourceKind?: TreasuryOperationFactSourceKind[];
}

export interface TreasuryOperationFactsRepository {
  findFactBySourceRef(
    sourceRef: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryOperationFactRecord | undefined>;
  insertFact(
    input: TreasuryOperationFactWriteModel,
    tx?: PersistenceSession,
  ): Promise<TreasuryOperationFactRecord | null>;
  listFacts(
    input: TreasuryOperationFactsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryOperationFactRecord[]; total: number }>;
}
