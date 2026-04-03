import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
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
