import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  TreasuryInventoryAllocationRecord,
  TreasuryInventoryPositionRecord,
  TreasuryInventoryPositionState,
  TreasuryOrderRecord,
  TreasuryOrderState,
  TreasuryOrderType,
} from "../../domain/types";

export interface TreasuryOrdersListQuery {
  limit: number;
  offset: number;
  state?: TreasuryOrderState;
  type?: TreasuryOrderType;
}

export interface TreasuryInventoryPositionsListQuery {
  currencyId?: string;
  limit: number;
  offset: number;
  ownerPartyId?: string;
  state?: TreasuryInventoryPositionState;
}

export interface TreasuryOrdersRepository {
  findById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryOrderRecord | undefined>;
  insert(
    input: TreasuryOrderRecord,
    tx?: PersistenceSession,
  ): Promise<TreasuryOrderRecord | null>;
  list(
    input: TreasuryOrdersListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryOrderRecord[]; total: number }>;
  update(
    input: TreasuryOrderRecord,
    tx?: PersistenceSession,
  ): Promise<TreasuryOrderRecord | undefined>;
  findInventoryPositionById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInventoryPositionRecord | undefined>;
  findInventoryPositionByQuoteExecutionId(
    executionId: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInventoryPositionRecord | undefined>;
  insertInventoryPosition(
    input: TreasuryInventoryPositionRecord,
    tx?: PersistenceSession,
  ): Promise<TreasuryInventoryPositionRecord | null>;
  listInventoryPositions(
    input: TreasuryInventoryPositionsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryInventoryPositionRecord[]; total: number }>;
  reserveInventoryAllocation(
    input: TreasuryInventoryAllocationRecord,
    tx?: PersistenceSession,
  ): Promise<{
    allocation: TreasuryInventoryAllocationRecord;
    position: TreasuryInventoryPositionRecord;
  } | null>;
  findReservedAllocationByDealAndQuote(
    input: { dealId: string; quoteId: string },
    tx?: PersistenceSession,
  ): Promise<TreasuryInventoryAllocationRecord | undefined>;
}
