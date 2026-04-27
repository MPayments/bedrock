import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
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
}
