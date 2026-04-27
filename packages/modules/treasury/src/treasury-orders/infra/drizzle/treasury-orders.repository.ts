import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import { treasuryOrders, treasuryOrderSteps } from "./schema";
import type {
  TreasuryOrdersListQuery,
  TreasuryOrdersRepository,
} from "../../application/ports/treasury-orders.repository";
import type {
  TreasuryOrderRecord,
  TreasuryOrderStepPlanRecord,
} from "../../domain/types";

type OrderRow = typeof treasuryOrders.$inferSelect;
type StepRow = typeof treasuryOrderSteps.$inferSelect;
type OrderInsertRow = typeof treasuryOrders.$inferInsert;
type StepInsertRow = typeof treasuryOrderSteps.$inferInsert;

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
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }

      return this.findById(input.id, database);
    });
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
