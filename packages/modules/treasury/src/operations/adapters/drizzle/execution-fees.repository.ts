import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryExecutionFees } from "./schema";
import type {
  TreasuryExecutionFeeListQuery,
  TreasuryExecutionFeeRecord,
  TreasuryExecutionFeesRepository,
  TreasuryExecutionFeeWriteModel,
} from "../../application/ports/operations.repository";

const TREASURY_EXECUTION_FEES_SORT_COLUMN_MAP = {
  chargedAt: treasuryExecutionFees.chargedAt,
  createdAt: treasuryExecutionFees.createdAt,
} as const;

export class DrizzleTreasuryExecutionFeesRepository
  implements TreasuryExecutionFeesRepository
{
  constructor(private readonly db: Queryable) {}

  async findFeeBySourceRef(sourceRef: string, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [fee] = await database
      .select()
      .from(treasuryExecutionFees)
      .where(eq(treasuryExecutionFees.sourceRef, sourceRef))
      .limit(1);

    return fee as TreasuryExecutionFeeRecord | undefined;
  }

  async insertFee(input: TreasuryExecutionFeeWriteModel, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const inserted = await database
      .insert(treasuryExecutionFees)
      .values(input)
      .onConflictDoNothing({
        target: treasuryExecutionFees.sourceRef,
      })
      .returning();

    if (!inserted.length) {
      return null;
    }

    return inserted[0] as TreasuryExecutionFeeRecord;
  }

  async listFees(input: TreasuryExecutionFeeListQuery, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions = [];

    if (input.dealId) {
      conditions.push(eq(treasuryExecutionFees.dealId, input.dealId));
    }

    if (input.operationId) {
      conditions.push(eq(treasuryExecutionFees.operationId, input.operationId));
    }

    if (input.routeLegId) {
      conditions.push(eq(treasuryExecutionFees.routeLegId, input.routeLegId));
    }

    if (input.sourceKind?.length) {
      conditions.push(inArray(treasuryExecutionFees.sourceKind, input.sourceKind));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "asc" ? asc : desc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      TREASURY_EXECUTION_FEES_SORT_COLUMN_MAP,
      treasuryExecutionFees.chargedAt,
    );

    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(treasuryExecutionFees)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(treasuryExecutionFees)
        .where(where),
    ]);

    return {
      rows: rows as TreasuryExecutionFeeRecord[],
      total: countRows[0]?.total ?? 0,
    };
  }
}
