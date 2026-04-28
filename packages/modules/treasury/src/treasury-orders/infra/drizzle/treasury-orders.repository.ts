import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import {
  treasuryInventoryAllocations,
  treasuryInventoryPositions,
  treasuryOrders,
  treasuryOrderSteps,
} from "./schema";
import type {
  TreasuryInventoryAllocationsListQuery,
  TreasuryOrdersListQuery,
  TreasuryOrdersRepository,
  TreasuryInventoryPositionsListQuery,
} from "../../application/ports/treasury-orders.repository";
import type {
  TreasuryInventoryAllocationRecord,
  TreasuryInventoryPositionRecord,
  TreasuryOrderRecord,
  TreasuryOrderStepPlanRecord,
} from "../../domain/types";

type OrderRow = typeof treasuryOrders.$inferSelect;
type StepRow = typeof treasuryOrderSteps.$inferSelect;
type InventoryPositionRow = typeof treasuryInventoryPositions.$inferSelect;
type InventoryAllocationRow = typeof treasuryInventoryAllocations.$inferSelect;
type OrderInsertRow = typeof treasuryOrders.$inferInsert;
type StepInsertRow = typeof treasuryOrderSteps.$inferInsert;
type InventoryPositionInsertRow = typeof treasuryInventoryPositions.$inferInsert;
type InventoryAllocationInsertRow =
  typeof treasuryInventoryAllocations.$inferInsert;

type TransactionalQueryable = Queryable & {
  transaction: <TResult>(
    callback: (tx: Transaction) => Promise<TResult>,
  ) => Promise<TResult>;
};

function hasTransaction(db: Queryable): db is TransactionalQueryable {
  return typeof (db as { transaction?: unknown }).transaction === "function";
}

function toStepRecord(row: StepRow): TreasuryOrderStepPlanRecord {
  return {
    createdAt: row.createdAt,
    fromAmountMinor: row.fromAmountMinor,
    fromCurrencyId: row.fromCurrencyId,
    fromParty: { id: row.fromPartyId, requisiteId: row.fromRequisiteId },
    id: row.id,
    kind: row.kind,
    paymentStepId: row.paymentStepId,
    quoteExecutionId: row.quoteExecutionId,
    quoteId: row.quoteId,
    rate: row.rate,
    sequence: row.sequence,
    sourceRef: row.sourceRef,
    toAmountMinor: row.toAmountMinor,
    toCurrencyId: row.toCurrencyId,
    toParty: { id: row.toPartyId, requisiteId: row.toRequisiteId },
    updatedAt: row.updatedAt,
  };
}

function toOrderRecord(
  row: OrderRow,
  steps: TreasuryOrderStepPlanRecord[],
): TreasuryOrderRecord {
  return {
    activatedAt: row.activatedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    description: row.description,
    id: row.id,
    state: row.state,
    steps,
    type: row.type,
    updatedAt: row.updatedAt,
  };
}

function toInventoryPositionRecord(
  row: InventoryPositionRow,
): TreasuryInventoryPositionRecord {
  return {
    acquiredAmountMinor: row.acquiredAmountMinor,
    availableAmountMinor: row.availableAmountMinor,
    costAmountMinor: row.costAmountMinor,
    costCurrencyId: row.costCurrencyId,
    createdAt: row.createdAt,
    currencyId: row.currencyId,
    id: row.id,
    ledgerSubjectType: row.ledgerSubjectType,
    ownerBookId: row.ownerBookId,
    ownerPartyId: row.ownerPartyId,
    ownerRequisiteId: row.ownerRequisiteId,
    sourceOrderId: row.sourceOrderId,
    sourcePostingDocumentId: row.sourcePostingDocumentId,
    sourcePostingDocumentKind: row.sourcePostingDocumentKind,
    sourceQuoteExecutionId: row.sourceQuoteExecutionId,
    state: row.state,
    updatedAt: row.updatedAt,
  };
}

function toInventoryAllocationRecord(
  row: InventoryAllocationRow,
): TreasuryInventoryAllocationRecord {
  return {
    amountMinor: row.amountMinor,
    costAmountMinor: row.costAmountMinor,
    consumedAt: row.consumedAt,
    createdAt: row.createdAt,
    currencyId: row.currencyId,
    dealId: row.dealId,
    id: row.id,
    ledgerHoldRef: row.ledgerHoldRef,
    ownerBookId: row.ownerBookId,
    ownerRequisiteId: row.ownerRequisiteId,
    positionId: row.positionId,
    quoteId: row.quoteId,
    releasedAt: row.releasedAt,
    reservedAt: row.reservedAt,
    state: row.state,
    updatedAt: row.updatedAt,
  };
}

function toOrderInsertRow(record: TreasuryOrderRecord): OrderInsertRow {
  return {
    activatedAt: record.activatedAt,
    cancelledAt: record.cancelledAt,
    createdAt: record.createdAt,
    description: record.description,
    id: record.id,
    state: record.state,
    type: record.type,
    updatedAt: record.updatedAt,
  };
}

function toStepInsertRow(
  orderId: string,
  record: TreasuryOrderStepPlanRecord,
): StepInsertRow {
  return {
    createdAt: record.createdAt,
    fromAmountMinor: record.fromAmountMinor,
    fromCurrencyId: record.fromCurrencyId,
    fromPartyId: record.fromParty.id,
    fromRequisiteId: record.fromParty.requisiteId,
    id: record.id,
    kind: record.kind,
    orderId,
    paymentStepId: record.paymentStepId,
    quoteExecutionId: record.quoteExecutionId,
    quoteId: record.quoteId,
    rate: record.rate,
    sequence: record.sequence,
    sourceRef: record.sourceRef,
    toAmountMinor: record.toAmountMinor,
    toCurrencyId: record.toCurrencyId,
    toPartyId: record.toParty.id,
    toRequisiteId: record.toParty.requisiteId,
    updatedAt: record.updatedAt,
  };
}

function toInventoryPositionInsertRow(
  record: TreasuryInventoryPositionRecord,
): InventoryPositionInsertRow {
  return {
    acquiredAmountMinor: record.acquiredAmountMinor,
    availableAmountMinor: record.availableAmountMinor,
    costAmountMinor: record.costAmountMinor,
    costCurrencyId: record.costCurrencyId,
    createdAt: record.createdAt,
    currencyId: record.currencyId,
    id: record.id,
    ledgerSubjectType: record.ledgerSubjectType,
    ownerBookId: record.ownerBookId,
    ownerPartyId: record.ownerPartyId,
    ownerRequisiteId: record.ownerRequisiteId,
    sourceOrderId: record.sourceOrderId,
    sourcePostingDocumentId: record.sourcePostingDocumentId,
    sourcePostingDocumentKind: record.sourcePostingDocumentKind,
    sourceQuoteExecutionId: record.sourceQuoteExecutionId,
    state: record.state,
    updatedAt: record.updatedAt,
  };
}

function toInventoryAllocationInsertRow(
  record: TreasuryInventoryAllocationRecord,
): InventoryAllocationInsertRow {
  return {
    amountMinor: record.amountMinor,
    costAmountMinor: record.costAmountMinor,
    consumedAt: record.consumedAt,
    createdAt: record.createdAt,
    currencyId: record.currencyId,
    dealId: record.dealId,
    id: record.id,
    ledgerHoldRef: record.ledgerHoldRef,
    ownerBookId: record.ownerBookId,
    ownerRequisiteId: record.ownerRequisiteId,
    positionId: record.positionId,
    quoteId: record.quoteId,
    releasedAt: record.releasedAt,
    reservedAt: record.reservedAt,
    state: record.state,
    updatedAt: record.updatedAt,
  };
}

export class DrizzleTreasuryOrdersRepository
  implements TreasuryOrdersRepository
{
  constructor(private readonly db: Queryable) {}

  async findById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryOrderRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [row] = await database
      .select()
      .from(treasuryOrders)
      .where(eq(treasuryOrders.id, id))
      .limit(1);
    if (!row) return undefined;

    const steps = await this.loadSteps(database, [id]);
    return toOrderRecord(row, steps.get(id) ?? []);
  }

  async insert(
    input: TreasuryOrderRecord,
    tx?: PersistenceSession,
  ): Promise<TreasuryOrderRecord | null> {
    return this.runWrite(tx, async (database) => {
      const inserted = await database
        .insert(treasuryOrders)
        .values(toOrderInsertRow(input))
        .onConflictDoNothing()
        .returning({ id: treasuryOrders.id });
      if (!inserted.length) return null;

      await database
        .insert(treasuryOrderSteps)
        .values(input.steps.map((step) => toStepInsertRow(input.id, step)));

      return (await this.findById(input.id, database)) ?? null;
    });
  }

  async list(
    input: TreasuryOrdersListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryOrderRecord[]; total: number }> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions: SQL[] = [];
    if (input.state) conditions.push(eq(treasuryOrders.state, input.state));
    if (input.type) conditions.push(eq(treasuryOrders.type, input.type));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(treasuryOrders)
        .where(where)
        .orderBy(desc(treasuryOrders.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(treasuryOrders)
        .where(where),
    ]);
    const steps = await this.loadSteps(
      database,
      rows.map((row) => row.id),
    );

    return {
      rows: rows.map((row) => toOrderRecord(row, steps.get(row.id) ?? [])),
      total: countRows[0]?.total ?? 0,
    };
  }

  async update(
    input: TreasuryOrderRecord,
    tx?: PersistenceSession,
  ): Promise<TreasuryOrderRecord | undefined> {
    return this.runWrite(tx, async (database) => {
      const [updated] = await database
        .update(treasuryOrders)
        .set(toOrderInsertRow(input))
        .where(eq(treasuryOrders.id, input.id))
        .returning({ id: treasuryOrders.id });
      if (!updated) return undefined;

      for (const step of input.steps) {
        await database
          .insert(treasuryOrderSteps)
          .values(toStepInsertRow(input.id, step))
          .onConflictDoUpdate({
            target: treasuryOrderSteps.id,
            set: {
              paymentStepId: sql`excluded.payment_step_id`,
              quoteExecutionId: sql`excluded.quote_execution_id`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }

      return this.findById(input.id, database);
    });
  }

  async findInventoryPositionById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInventoryPositionRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [row] = await database
      .select()
      .from(treasuryInventoryPositions)
      .where(eq(treasuryInventoryPositions.id, id))
      .limit(1);
    return row ? toInventoryPositionRecord(row) : undefined;
  }

  async findInventoryPositionByQuoteExecutionId(
    executionId: string,
    tx?: PersistenceSession,
  ): Promise<TreasuryInventoryPositionRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [row] = await database
      .select()
      .from(treasuryInventoryPositions)
      .where(eq(treasuryInventoryPositions.sourceQuoteExecutionId, executionId))
      .limit(1);
    return row ? toInventoryPositionRecord(row) : undefined;
  }

  async insertInventoryPosition(
    input: TreasuryInventoryPositionRecord,
    tx?: PersistenceSession,
  ): Promise<TreasuryInventoryPositionRecord | null> {
    return this.runWrite(tx, async (database) => {
      const [inserted] = await database
        .insert(treasuryInventoryPositions)
        .values(toInventoryPositionInsertRow(input))
        .onConflictDoNothing()
        .returning();
      return inserted ? toInventoryPositionRecord(inserted) : null;
    });
  }

  async listInventoryPositions(
    input: TreasuryInventoryPositionsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryInventoryPositionRecord[]; total: number }> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions: SQL[] = [];
    if (input.currencyId) {
      conditions.push(eq(treasuryInventoryPositions.currencyId, input.currencyId));
    }
    if (input.ownerPartyId) {
      conditions.push(eq(treasuryInventoryPositions.ownerPartyId, input.ownerPartyId));
    }
    if (input.sourceOrderId) {
      conditions.push(eq(treasuryInventoryPositions.sourceOrderId, input.sourceOrderId));
    }
    if (input.sourceQuoteExecutionId) {
      conditions.push(
        eq(treasuryInventoryPositions.sourceQuoteExecutionId, input.sourceQuoteExecutionId),
      );
    }
    if (input.state) {
      conditions.push(eq(treasuryInventoryPositions.state, input.state));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(treasuryInventoryPositions)
        .where(where)
        .orderBy(desc(treasuryInventoryPositions.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(treasuryInventoryPositions)
        .where(where),
    ]);

    return {
      rows: rows.map(toInventoryPositionRecord),
      total: countRows[0]?.total ?? 0,
    };
  }

  async listInventoryAllocations(
    input: TreasuryInventoryAllocationsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: TreasuryInventoryAllocationRecord[]; total: number }> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions: SQL[] = [];
    if (input.positionId) {
      conditions.push(eq(treasuryInventoryAllocations.positionId, input.positionId));
    }
    if (input.dealId) {
      conditions.push(eq(treasuryInventoryAllocations.dealId, input.dealId));
    }
    if (input.quoteId) {
      conditions.push(eq(treasuryInventoryAllocations.quoteId, input.quoteId));
    }
    if (input.state) {
      conditions.push(eq(treasuryInventoryAllocations.state, input.state));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(treasuryInventoryAllocations)
        .where(where)
        .orderBy(desc(treasuryInventoryAllocations.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(treasuryInventoryAllocations)
        .where(where),
    ]);

    return {
      rows: rows.map(toInventoryAllocationRecord),
      total: countRows[0]?.total ?? 0,
    };
  }

  async reserveInventoryAllocation(
    input: TreasuryInventoryAllocationRecord,
    tx?: PersistenceSession,
  ): Promise<{
    allocation: TreasuryInventoryAllocationRecord;
    position: TreasuryInventoryPositionRecord;
  } | null> {
    return this.runWrite(tx, async (database) => {
      const [position] = await database
        .select()
        .from(treasuryInventoryPositions)
        .where(eq(treasuryInventoryPositions.id, input.positionId))
        .limit(1);
      if (
        !position ||
        position.state !== "open" ||
        position.availableAmountMinor < input.amountMinor
      ) {
        return null;
      }

      const nextAvailable = position.availableAmountMinor - input.amountMinor;
      const nextState = nextAvailable === 0n ? "exhausted" : "open";
      const [updatedPosition] = await database
        .update(treasuryInventoryPositions)
        .set({
          availableAmountMinor: nextAvailable,
          state: nextState,
          updatedAt: input.updatedAt,
        })
        .where(eq(treasuryInventoryPositions.id, input.positionId))
        .returning();
      if (!updatedPosition) {
        return null;
      }

      const [insertedAllocation] = await database
        .insert(treasuryInventoryAllocations)
        .values(toInventoryAllocationInsertRow(input))
        .returning();
      if (!insertedAllocation) {
        return null;
      }

      return {
        allocation: toInventoryAllocationRecord(insertedAllocation),
        position: toInventoryPositionRecord(updatedPosition),
      };
    });
  }

  async updateInventoryAllocationState(
    input: {
      allocationId: string;
      at: Date;
      state: "consumed" | "released";
    },
    tx?: PersistenceSession,
  ): Promise<{
    allocation: TreasuryInventoryAllocationRecord;
    position: TreasuryInventoryPositionRecord;
  } | null> {
    return this.runWrite(tx, async (database) => {
      const [allocation] = await database
        .select()
        .from(treasuryInventoryAllocations)
        .where(eq(treasuryInventoryAllocations.id, input.allocationId))
        .limit(1);
      if (!allocation || allocation.state !== "reserved") {
        return null;
      }

      const [position] = await database
        .select()
        .from(treasuryInventoryPositions)
        .where(eq(treasuryInventoryPositions.id, allocation.positionId))
        .limit(1);
      if (!position) {
        return null;
      }

      let nextPosition = position;
      if (input.state === "released") {
        const nextAvailable =
          position.availableAmountMinor + allocation.amountMinor;
        const [updatedPosition] = await database
          .update(treasuryInventoryPositions)
          .set({
            availableAmountMinor: nextAvailable,
            state: "open",
            updatedAt: input.at,
          })
          .where(eq(treasuryInventoryPositions.id, position.id))
          .returning();
        if (!updatedPosition) {
          return null;
        }
        nextPosition = updatedPosition;
      }

      const [updatedAllocation] = await database
        .update(treasuryInventoryAllocations)
        .set({
          consumedAt: input.state === "consumed" ? input.at : allocation.consumedAt,
          releasedAt: input.state === "released" ? input.at : allocation.releasedAt,
          state: input.state,
          updatedAt: input.at,
        })
        .where(eq(treasuryInventoryAllocations.id, input.allocationId))
        .returning();
      if (!updatedAllocation) {
        return null;
      }

      return {
        allocation: toInventoryAllocationRecord(updatedAllocation),
        position: toInventoryPositionRecord(nextPosition),
      };
    });
  }

  async findReservedAllocationByDealAndQuote(
    input: { dealId: string; quoteId: string },
    tx?: PersistenceSession,
  ): Promise<TreasuryInventoryAllocationRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [row] = await database
      .select()
      .from(treasuryInventoryAllocations)
      .where(
        and(
          eq(treasuryInventoryAllocations.dealId, input.dealId),
          eq(treasuryInventoryAllocations.quoteId, input.quoteId),
          eq(treasuryInventoryAllocations.state, "reserved"),
        ),
      )
      .limit(1);
    return row ? toInventoryAllocationRecord(row) : undefined;
  }

  private async loadSteps(database: Queryable, orderIds: string[]) {
    const byOrderId = new Map<string, TreasuryOrderStepPlanRecord[]>();
    if (!orderIds.length) return byOrderId;

    const rows = await database
      .select()
      .from(treasuryOrderSteps)
      .where(inArray(treasuryOrderSteps.orderId, orderIds))
      .orderBy(treasuryOrderSteps.orderId, treasuryOrderSteps.sequence);
    for (const row of rows) {
      const steps = byOrderId.get(row.orderId) ?? [];
      steps.push(toStepRecord(row));
      byOrderId.set(row.orderId, steps);
    }
    return byOrderId;
  }

  private async runWrite<TResult>(
    tx: PersistenceSession | undefined,
    work: (database: Queryable) => Promise<TResult>,
  ): Promise<TResult> {
    if (tx) return work(tx as Transaction);
    if (hasTransaction(this.db)) {
      return this.db.transaction((database) => work(database));
    }
    return work(this.db);
  }
}
