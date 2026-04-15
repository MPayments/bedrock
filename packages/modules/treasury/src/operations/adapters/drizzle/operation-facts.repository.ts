import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryOperationFacts } from "./schema";
import type {
  TreasuryOperationFactRecord,
  TreasuryOperationFactsListQuery,
  TreasuryOperationFactsRepository,
  TreasuryOperationFactWriteModel,
} from "../../application/ports/operations.repository";

const TREASURY_OPERATION_FACTS_SORT_COLUMN_MAP = {
  createdAt: treasuryOperationFacts.createdAt,
  recordedAt: treasuryOperationFacts.recordedAt,
} as const;

export class DrizzleTreasuryOperationFactsRepository
  implements TreasuryOperationFactsRepository
{
  constructor(private readonly db: Queryable) {}

  async findFactBySourceRef(sourceRef: string, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [fact] = await database
      .select()
      .from(treasuryOperationFacts)
      .where(eq(treasuryOperationFacts.sourceRef, sourceRef))
      .limit(1);

    return fact as TreasuryOperationFactRecord | undefined;
  }

  async insertFact(input: TreasuryOperationFactWriteModel, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const inserted = await database
      .insert(treasuryOperationFacts)
      .values(input)
      .onConflictDoNothing({
        target: treasuryOperationFacts.sourceRef,
      })
      .returning();

    if (!inserted.length) {
      return null;
    }

    return inserted[0] as TreasuryOperationFactRecord;
  }

  async listFacts(input: TreasuryOperationFactsListQuery, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions = [];

    if (input.dealId) {
      conditions.push(eq(treasuryOperationFacts.dealId, input.dealId));
    }

    if (input.operationId) {
      conditions.push(eq(treasuryOperationFacts.operationId, input.operationId));
    }

    if (input.routeLegId) {
      conditions.push(eq(treasuryOperationFacts.routeLegId, input.routeLegId));
    }

    if (input.sourceKind?.length) {
      conditions.push(inArray(treasuryOperationFacts.sourceKind, input.sourceKind));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "asc" ? asc : desc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      TREASURY_OPERATION_FACTS_SORT_COLUMN_MAP,
      treasuryOperationFacts.recordedAt,
    );

    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(treasuryOperationFacts)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(treasuryOperationFacts)
        .where(where),
    ]);

    return {
      rows: rows as TreasuryOperationFactRecord[],
      total: countRows[0]?.total ?? 0,
    };
  }
}
