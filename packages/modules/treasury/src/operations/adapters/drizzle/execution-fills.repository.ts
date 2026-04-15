import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryExecutionFills } from "./schema";
import type {
  TreasuryExecutionFillListQuery,
  TreasuryExecutionFillRecord,
  TreasuryExecutionFillsRepository,
  TreasuryExecutionFillWriteModel,
} from "../../application/ports/operations.repository";

const TREASURY_EXECUTION_FILLS_SORT_COLUMN_MAP = {
  createdAt: treasuryExecutionFills.createdAt,
  executedAt: treasuryExecutionFills.executedAt,
} as const;

export class DrizzleTreasuryExecutionFillsRepository
  implements TreasuryExecutionFillsRepository
{
  constructor(private readonly db: Queryable) {}

  async findFillBySourceRef(sourceRef: string, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [fill] = await database
      .select()
      .from(treasuryExecutionFills)
      .where(eq(treasuryExecutionFills.sourceRef, sourceRef))
      .limit(1);

    return fill as TreasuryExecutionFillRecord | undefined;
  }

  async insertFill(
    input: TreasuryExecutionFillWriteModel,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const inserted = await database
      .insert(treasuryExecutionFills)
      .values(input)
      .onConflictDoNothing({
        target: treasuryExecutionFills.sourceRef,
      })
      .returning();

    if (!inserted.length) {
      return null;
    }

    return inserted[0] as TreasuryExecutionFillRecord;
  }

  async listFills(
    input: TreasuryExecutionFillListQuery,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions = [];

    if (input.dealId) {
      conditions.push(eq(treasuryExecutionFills.dealId, input.dealId));
    }

    if (input.operationId) {
      conditions.push(eq(treasuryExecutionFills.operationId, input.operationId));
    }

    if (input.routeLegId) {
      conditions.push(eq(treasuryExecutionFills.routeLegId, input.routeLegId));
    }

    if (input.sourceKind?.length) {
      conditions.push(inArray(treasuryExecutionFills.sourceKind, input.sourceKind));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "asc" ? asc : desc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      TREASURY_EXECUTION_FILLS_SORT_COLUMN_MAP,
      treasuryExecutionFills.executedAt,
    );

    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(treasuryExecutionFills)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(treasuryExecutionFills)
        .where(where),
    ]);

    return {
      rows: rows as TreasuryExecutionFillRecord[],
      total: countRows[0]?.total ?? 0,
    };
  }
}
