import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import type { Queryable, Transaction } from "@bedrock/platform/persistence";
import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import {
  paymentStepArtifacts,
  paymentStepAttempts,
  paymentSteps,
} from "./schema";
import type {
  PaymentStepsListQuery,
  PaymentStepsRepository,
} from "../../application/ports/payment-steps.repository";
import type {
  ArtifactRef,
  PaymentStepAttemptRecord,
  PaymentStepRecord,
} from "../../domain/types";

type PaymentStepRow = typeof paymentSteps.$inferSelect;
type PaymentStepArtifactRow = typeof paymentStepArtifacts.$inferSelect;
type PaymentStepAttemptRow = typeof paymentStepAttempts.$inferSelect;
type PaymentStepInsertRow = typeof paymentSteps.$inferInsert;
type PaymentStepArtifactInsertRow = typeof paymentStepArtifacts.$inferInsert;
type PaymentStepAttemptInsertRow = typeof paymentStepAttempts.$inferInsert;

type TransactionalQueryable = Queryable & {
  transaction: <TResult>(
    callback: (tx: Transaction) => Promise<TResult>,
  ) => Promise<TResult>;
};

function hasTransaction(db: Queryable): db is TransactionalQueryable {
  return typeof (db as { transaction?: unknown }).transaction === "function";
}

function toStepRecord(
  row: PaymentStepRow,
  attempts: PaymentStepAttemptRecord[] = [],
  artifacts: ArtifactRef[] = [],
): PaymentStepRecord {
  return {
    artifacts,
    attempts,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    dealId: row.dealId,
    dealLegIdx: row.dealLegIdx,
    dealLegRole: row.dealLegRole,
    failureReason: row.failureReason,
    fromAmountMinor: row.fromAmountMinor,
    fromCurrencyId: row.fromCurrencyId,
    fromParty: {
      id: row.fromPartyId,
      requisiteId: row.fromRequisiteId,
    },
    id: row.id,
    kind: row.kind,
    postings: row.postings,
    purpose: row.purpose,
    rate: row.rateValue
      ? {
          lockedSide: row.rateLockedSide ?? "in",
          value: row.rateValue,
        }
      : null,
    scheduledAt: row.scheduledAt,
    state: row.state,
    submittedAt: row.submittedAt,
    toAmountMinor: row.toAmountMinor,
    toCurrencyId: row.toCurrencyId,
    toParty: {
      id: row.toPartyId,
      requisiteId: row.toRequisiteId,
    },
    treasuryBatchId: row.treasuryBatchId,
    updatedAt: row.updatedAt,
  };
}

function toArtifactRef(row: PaymentStepArtifactRow): ArtifactRef {
  return {
    fileAssetId: row.fileAssetId,
    purpose: row.purpose,
  };
}

function toAttemptRecord(row: PaymentStepAttemptRow): PaymentStepAttemptRecord {
  return {
    attemptNo: row.attemptNo,
    createdAt: row.createdAt,
    id: row.id,
    outcome: row.outcome,
    outcomeAt: row.outcomeAt,
    paymentStepId: row.paymentStepId,
    providerRef: row.providerRef,
    providerSnapshot: row.providerSnapshot,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

function toArtifactInsertRow(
  paymentStepId: string,
  artifact: ArtifactRef,
): PaymentStepArtifactInsertRow {
  return {
    fileAssetId: artifact.fileAssetId,
    paymentStepId,
    purpose: artifact.purpose,
  };
}

function toStepInsertRow(record: PaymentStepRecord): PaymentStepInsertRow {
  return {
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    dealId: record.dealId,
    dealLegIdx: record.dealLegIdx,
    dealLegRole: record.dealLegRole,
    failureReason: record.failureReason,
    fromAmountMinor: record.fromAmountMinor,
    fromCurrencyId: record.fromCurrencyId,
    fromPartyId: record.fromParty.id,
    fromRequisiteId: record.fromParty.requisiteId,
    id: record.id,
    kind: record.kind,
    postings: record.postings,
    purpose: record.purpose,
    rateLockedSide: record.rate?.lockedSide ?? null,
    rateValue: record.rate?.value ?? null,
    scheduledAt: record.scheduledAt,
    state: record.state,
    submittedAt: record.submittedAt,
    toAmountMinor: record.toAmountMinor,
    toCurrencyId: record.toCurrencyId,
    toPartyId: record.toParty.id,
    toRequisiteId: record.toParty.requisiteId,
    treasuryBatchId: record.treasuryBatchId,
    updatedAt: record.updatedAt,
  };
}

function toAttemptInsertRow(
  record: PaymentStepAttemptRecord,
): PaymentStepAttemptInsertRow {
  return {
    attemptNo: record.attemptNo,
    createdAt: record.createdAt,
    id: record.id,
    outcome: record.outcome,
    outcomeAt: record.outcomeAt,
    paymentStepId: record.paymentStepId,
    providerRef: record.providerRef,
    providerSnapshot: record.providerSnapshot,
    submittedAt: record.submittedAt,
    updatedAt: record.updatedAt,
  };
}

export class DrizzlePaymentStepsRepository implements PaymentStepsRepository {
  constructor(private readonly db: Queryable) {}

  async findStepById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<PaymentStepRecord | undefined> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const [row] = await database
      .select()
      .from(paymentSteps)
      .where(eq(paymentSteps.id, id))
      .limit(1);

    if (!row) {
      return undefined;
    }

    const [attempts, artifacts] = await Promise.all([
      this.loadAttemptRecords(database, [id]),
      this.loadArtifactRecords(database, [id]),
    ]);

    return toStepRecord(row, attempts.get(id) ?? [], artifacts.get(id) ?? []);
  }

  async insertStep(
    input: PaymentStepRecord,
    tx?: PersistenceSession,
  ): Promise<PaymentStepRecord | null> {
    return this.runWrite(tx, async (database) => {
      const inserted = await database
        .insert(paymentSteps)
        .values(toStepInsertRow(input))
        .onConflictDoNothing()
        .returning({ id: paymentSteps.id });

      if (!inserted.length) {
        return null;
      }

      await Promise.all([
        this.upsertAttempts(database, input.attempts),
        this.upsertArtifacts(database, input.id, input.artifacts),
      ]);

      return (await this.findStepById(input.id, database)) ?? null;
    });
  }

  async listSteps(
    input: PaymentStepsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: PaymentStepRecord[]; total: number }> {
    const database = (tx as Transaction | undefined) ?? this.db;
    const conditions: SQL[] = [];

    if (input.batchId) {
      conditions.push(eq(paymentSteps.treasuryBatchId, input.batchId));
    }
    if (input.createdFrom) {
      conditions.push(gte(paymentSteps.createdAt, input.createdFrom));
    }
    if (input.createdTo) {
      conditions.push(lte(paymentSteps.createdAt, input.createdTo));
    }
    if (input.dealId) {
      conditions.push(eq(paymentSteps.dealId, input.dealId));
    }
    if (input.purpose) {
      conditions.push(eq(paymentSteps.purpose, input.purpose));
    }
    if (input.state?.length) {
      conditions.push(inArray(paymentSteps.state, input.state));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, countRows] = await Promise.all([
      database
        .select()
        .from(paymentSteps)
        .where(where)
        .orderBy(desc(paymentSteps.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      database
        .select({ total: sql<number>`count(*)::int` })
        .from(paymentSteps)
        .where(where),
    ]);
    const stepIds = rows.map((row) => row.id);
    const [attempts, artifacts] = await Promise.all([
      this.loadAttemptRecords(database, stepIds),
      this.loadArtifactRecords(database, stepIds),
    ]);

    return {
      rows: rows.map((row) =>
        toStepRecord(
          row,
          attempts.get(row.id) ?? [],
          artifacts.get(row.id) ?? [],
        ),
      ),
      total: countRows[0]?.total ?? 0,
    };
  }

  async updateStep(
    input: PaymentStepRecord,
    tx?: PersistenceSession,
  ): Promise<PaymentStepRecord | undefined> {
    return this.runWrite(tx, async (database) => {
      const [updated] = await database
        .update(paymentSteps)
        .set(toStepInsertRow(input))
        .where(eq(paymentSteps.id, input.id))
        .returning({ id: paymentSteps.id });

      if (!updated) {
        return undefined;
      }

      await Promise.all([
        this.upsertAttempts(database, input.attempts),
        this.upsertArtifacts(database, input.id, input.artifacts),
      ]);

      return this.findStepById(input.id, database);
    });
  }

  private async loadArtifactRecords(
    database: Queryable,
    stepIds: string[],
  ): Promise<Map<string, ArtifactRef[]>> {
    if (stepIds.length === 0) {
      return new Map();
    }

    const rows = await database
      .select()
      .from(paymentStepArtifacts)
      .where(inArray(paymentStepArtifacts.paymentStepId, stepIds))
      .orderBy(
        paymentStepArtifacts.paymentStepId,
        paymentStepArtifacts.createdAt,
      );
    const byStepId = new Map<string, ArtifactRef[]>();

    for (const row of rows) {
      const artifacts = byStepId.get(row.paymentStepId) ?? [];
      artifacts.push(toArtifactRef(row));
      byStepId.set(row.paymentStepId, artifacts);
    }

    return byStepId;
  }

  private async loadAttemptRecords(
    database: Queryable,
    stepIds: string[],
  ): Promise<Map<string, PaymentStepAttemptRecord[]>> {
    if (stepIds.length === 0) {
      return new Map();
    }

    const rows = await database
      .select()
      .from(paymentStepAttempts)
      .where(inArray(paymentStepAttempts.paymentStepId, stepIds))
      .orderBy(paymentStepAttempts.paymentStepId, paymentStepAttempts.attemptNo);
    const byStepId = new Map<string, PaymentStepAttemptRecord[]>();

    for (const row of rows) {
      const attempts = byStepId.get(row.paymentStepId) ?? [];
      attempts.push(toAttemptRecord(row));
      byStepId.set(row.paymentStepId, attempts);
    }

    return byStepId;
  }

  private async runWrite<TResult>(
    tx: PersistenceSession | undefined,
    work: (database: Queryable) => Promise<TResult>,
  ): Promise<TResult> {
    if (tx) {
      return work(tx as Transaction);
    }
    if (hasTransaction(this.db)) {
      return this.db.transaction((database) => work(database));
    }

    return work(this.db);
  }

  private async upsertAttempts(
    database: Queryable,
    attempts: PaymentStepAttemptRecord[],
  ): Promise<void> {
    if (attempts.length === 0) {
      return;
    }

    await database
      .insert(paymentStepAttempts)
      .values(attempts.map(toAttemptInsertRow))
      .onConflictDoUpdate({
        target: paymentStepAttempts.id,
        set: {
          attemptNo: sql`excluded.attempt_no`,
          outcome: sql`excluded.outcome`,
          outcomeAt: sql`excluded.outcome_at`,
          providerRef: sql`excluded.provider_ref`,
          providerSnapshot: sql`excluded.provider_snapshot`,
          submittedAt: sql`excluded.submitted_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  private async upsertArtifacts(
    database: Queryable,
    paymentStepId: string,
    artifacts: ArtifactRef[],
  ): Promise<void> {
    if (artifacts.length === 0) {
      return;
    }

    await database
      .insert(paymentStepArtifacts)
      .values(
        artifacts.map((artifact) =>
          toArtifactInsertRow(paymentStepId, artifact),
        ),
      )
      .onConflictDoUpdate({
        target: [
          paymentStepArtifacts.paymentStepId,
          paymentStepArtifacts.fileAssetId,
          paymentStepArtifacts.purpose,
        ],
        set: {
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}
