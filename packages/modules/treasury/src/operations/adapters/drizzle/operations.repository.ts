import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
} from "@bedrock/shared/core/pagination";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryOperations } from "./schema";
import type {
  TreasuryOperationsListQuery,
  TreasuryOperationRecord,
  TreasuryOperationsRepository,
  TreasuryOperationWriteModel,
} from "../../application/ports/operations.repository";

const TREASURY_OPERATIONS_SORT_COLUMN_MAP = {
  createdAt: treasuryOperations.createdAt,
  kind: treasuryOperations.kind,
} as const;

export class DrizzleTreasuryOperationsRepository implements TreasuryOperationsRepository {
  constructor(private readonly db: Queryable) {}

  async findOperationById(id: string, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [operation] = await database
      .select()
      .from(treasuryOperations)
      .where(eq(treasuryOperations.id, id))
      .limit(1);

    return operation as TreasuryOperationRecord | undefined;
  }

  async findOperationBySourceRef(sourceRef: string, tx?: PersistenceSession) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [operation] = await database
      .select()
      .from(treasuryOperations)
      .where(eq(treasuryOperations.sourceRef, sourceRef))
      .limit(1);

    return operation as TreasuryOperationRecord | undefined;
  }

  async insertOperation(
    input: TreasuryOperationWriteModel,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const inserted = await database
      .insert(treasuryOperations)
      .values(input)
      .onConflictDoNothing({
        target: treasuryOperations.sourceRef,
      })
      .returning();

    if (!inserted.length) {
      return null;
    }

    return inserted[0] as TreasuryOperationRecord;
  }

  async listOperations(
    input: TreasuryOperationsListQuery,
    tx?: PersistenceSession,
  ) {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions = [];

    if (input.dealId) {
      conditions.push(eq(treasuryOperations.dealId, input.dealId));
    }

    if (input.internalEntityOrganizationId) {
      conditions.push(
        eq(
          treasuryOperations.internalEntityOrganizationId,
          input.internalEntityOrganizationId,
        ),
      );
    }

    if (input.kind?.length) {
      conditions.push(inArray(treasuryOperations.kind, input.kind));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "asc" ? asc : desc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      TREASURY_OPERATIONS_SORT_COLUMN_MAP,
      treasuryOperations.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(treasuryOperations)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(treasuryOperations)
        .where(where),
    ]);

    return {
      rows: rows as TreasuryOperationRecord[],
      total: countRows[0]?.total ?? 0,
    };
  }
}
