import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryCashMovements } from "./schema";
import type {
  TreasuryCashMovementListQuery,
  TreasuryCashMovementRecord,
  TreasuryCashMovementsRepository,
  TreasuryCashMovementWriteModel,
} from "../../application/ports/operations.repository";

const TREASURY_CASH_MOVEMENTS_SORT_COLUMN_MAP = {
  bookedAt: treasuryCashMovements.bookedAt,
  createdAt: treasuryCashMovements.createdAt,
} as const;

export class DrizzleTreasuryCashMovementsRepository
  implements TreasuryCashMovementsRepository
{
  constructor(private readonly db: Queryable) {}

  async findCashMovementBySourceRef(
    sourceRef: string,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [movement] = await database
      .select()
      .from(treasuryCashMovements)
      .where(eq(treasuryCashMovements.sourceRef, sourceRef))
      .limit(1);

    return movement as TreasuryCashMovementRecord | undefined;
  }

  async insertCashMovement(
    input: TreasuryCashMovementWriteModel,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const inserted = await database
      .insert(treasuryCashMovements)
      .values(input)
      .onConflictDoNothing({
        target: treasuryCashMovements.sourceRef,
      })
      .returning();

    if (!inserted.length) {
      return null;
    }

    return inserted[0] as TreasuryCashMovementRecord;
  }

  async listCashMovements(
    input: TreasuryCashMovementListQuery,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions = [];

    if (input.dealId) {
      conditions.push(eq(treasuryCashMovements.dealId, input.dealId));
    }

    if (input.operationId) {
      conditions.push(eq(treasuryCashMovements.operationId, input.operationId));
    }

    if (input.routeLegId) {
      conditions.push(eq(treasuryCashMovements.routeLegId, input.routeLegId));
    }

    if (input.sourceKind?.length) {
      conditions.push(inArray(treasuryCashMovements.sourceKind, input.sourceKind));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "asc" ? asc : desc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      TREASURY_CASH_MOVEMENTS_SORT_COLUMN_MAP,
      treasuryCashMovements.bookedAt,
    );

    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(treasuryCashMovements)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(treasuryCashMovements)
        .where(where),
    ]);

    return {
      rows: rows as TreasuryCashMovementRecord[],
      total: countRows[0]?.total ?? 0,
    };
  }
}
