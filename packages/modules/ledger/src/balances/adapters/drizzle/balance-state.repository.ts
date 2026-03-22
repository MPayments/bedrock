import { and, eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import { pgNotify } from "@bedrock/platform/persistence/notify";

import { schema } from "./schema";
import { LedgerError } from "../../../errors";
import type { BalancesStateRepository } from "../../application/balances/ports";
import type { BalanceSubjectInput } from "../../contracts";
import type { BalanceEventInput } from "../../domain/balance-events";
import {
  toBalanceHoldSnapshot,
  type BalanceHoldRecord,
  type BalanceHoldUpdate,
} from "../../domain/balance-hold";
import {
  createZeroBalanceSnapshot,
  type BalanceSnapshot,
} from "../../domain/balance-position";
import type { BalanceSubject } from "../../domain/balance-subject";

function toBalanceSnapshot(row: {
  bookId: string;
  subjectType: string;
  subjectId: string;
  currency: string;
  ledgerBalance: bigint;
  available: bigint;
  reserved: bigint;
  pending: bigint;
  version: number;
}): BalanceSnapshot {
  return {
    bookId: row.bookId,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    currency: row.currency,
    ledgerBalance: row.ledgerBalance,
    available: row.available,
    reserved: row.reserved,
    pending: row.pending,
    version: row.version,
  };
}

function toBalanceHoldRecord(row: {
  id: string;
  holdRef: string;
  amountMinor: bigint;
  state: BalanceHoldRecord["state"];
  reason: string | null;
  actorId: string | null;
  createdAt: Date;
  releasedAt: Date | null;
  consumedAt: Date | null;
}): BalanceHoldRecord {
  return {
    id: row.id,
    holdRef: row.holdRef,
    amountMinor: row.amountMinor,
    state: row.state,
    reason: row.reason,
    actorId: row.actorId,
    createdAt: row.createdAt,
    releasedAt: row.releasedAt,
    consumedAt: row.consumedAt,
  };
}

export class DrizzleBalancesStateRepository implements BalancesStateRepository {
  constructor(private readonly db: Queryable) {}

  getBalancePosition(subject: BalanceSubjectInput) {
    return this.selectBalancePosition(subject, false);
  }

  getBalancePositionForUpdate(subject: BalanceSubjectInput) {
    return this.selectBalancePosition(subject, true);
  }

  ensureBalancePosition(subject: BalanceSubjectInput) {
    return this.doEnsureBalancePosition(subject);
  }

  updateBalancePosition(input: {
    subject: BalanceSubjectInput;
    delta: {
      deltaAvailable?: bigint;
      deltaReserved?: bigint;
      deltaPending?: bigint;
      deltaLedgerBalance?: bigint;
    };
  }) {
    return this.doUpdateBalancePosition(input);
  }

  getHold(subject: BalanceSubjectInput, holdRef: string) {
    return this.selectHold(subject, holdRef, false);
  }

  getHoldForUpdate(subject: BalanceSubjectInput, holdRef: string) {
    return this.selectHold(subject, holdRef, true);
  }

  createHold(input: {
    subject: BalanceSubjectInput;
    holdRef: string;
    amountMinor: bigint;
    state: BalanceHoldRecord["state"];
    reason?: string | null;
    actorId?: string | null;
    requestContext?: BalanceEventInput["requestContext"];
  }) {
    return this.doCreateHold(input);
  }

  updateHold(holdId: string, update: BalanceHoldUpdate) {
    return this.doUpdateHold(holdId, update);
  }

  appendBalanceEvent(input: BalanceEventInput) {
    return this.doAppendBalanceEvent(input);
  }

  loadMutationReplayResult(
    subject: BalanceSubjectInput,
    holdRef?: string | null,
  ) {
    return this.doLoadMutationReplayResult(subject, holdRef);
  }

  private async selectBalancePosition(
    subject: BalanceSubject,
    forUpdate: boolean,
  ) {
    const query = this.db
      .select()
      .from(schema.balancePositions)
      .where(
        and(
          eq(schema.balancePositions.bookId, subject.bookId),
          eq(schema.balancePositions.subjectType, subject.subjectType),
          eq(schema.balancePositions.subjectId, subject.subjectId),
          eq(schema.balancePositions.currency, subject.currency),
        ),
      )
      .limit(1);

    const rows =
      forUpdate && "for" in query ? await query.for("update") : await query;
    const row = rows[0];
    return row ? toBalanceSnapshot(row) : null;
  }

  private async selectHold(
    subject: BalanceSubject,
    holdRef: string,
    forUpdate: boolean,
  ) {
    const query = this.db
      .select()
      .from(schema.balanceHolds)
      .where(
        and(
          eq(schema.balanceHolds.bookId, subject.bookId),
          eq(schema.balanceHolds.subjectType, subject.subjectType),
          eq(schema.balanceHolds.subjectId, subject.subjectId),
          eq(schema.balanceHolds.currency, subject.currency),
          eq(schema.balanceHolds.holdRef, holdRef),
        ),
      )
      .limit(1);

    const rows =
      forUpdate && "for" in query ? await query.for("update") : await query;
    const row = rows[0];
    return row ? toBalanceHoldRecord(row) : null;
  }

  private async doEnsureBalancePosition(subject: BalanceSubject) {
    const existing = await this.selectBalancePosition(subject, true);
    if (existing) {
      return existing;
    }

    await this.db
      .insert(schema.balancePositions)
      .values({
        bookId: subject.bookId,
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        currency: subject.currency,
      })
      .onConflictDoNothing();

    const created = await this.selectBalancePosition(subject, true);
    if (!created) {
      throw new LedgerError("Failed to initialize balance position");
    }

    return created;
  }

  private async doUpdateBalancePosition(input: {
    subject: BalanceSubjectInput;
    delta: {
      deltaAvailable?: bigint;
      deltaReserved?: bigint;
      deltaPending?: bigint;
      deltaLedgerBalance?: bigint;
    };
  }) {
    const [updated] = await this.db
      .update(schema.balancePositions)
      .set({
        available: sql`${schema.balancePositions.available} + ${input.delta.deltaAvailable ?? 0n}`,
        reserved: sql`${schema.balancePositions.reserved} + ${input.delta.deltaReserved ?? 0n}`,
        pending: sql`${schema.balancePositions.pending} + ${input.delta.deltaPending ?? 0n}`,
        ledgerBalance: sql`${schema.balancePositions.ledgerBalance} + ${input.delta.deltaLedgerBalance ?? 0n}`,
        updatedAt: sql`now()`,
        version: sql`${schema.balancePositions.version} + 1`,
      })
      .where(
        and(
          eq(schema.balancePositions.bookId, input.subject.bookId),
          eq(schema.balancePositions.subjectType, input.subject.subjectType),
          eq(schema.balancePositions.subjectId, input.subject.subjectId),
          eq(schema.balancePositions.currency, input.subject.currency),
        ),
      )
      .returning();

    if (!updated) {
      throw new LedgerError("Balance position update failed");
    }

    return toBalanceSnapshot(updated);
  }

  private async doCreateHold(input: {
    subject: BalanceSubjectInput;
    holdRef: string;
    amountMinor: bigint;
    state: BalanceHoldRecord["state"];
    reason?: string | null;
    actorId?: string | null;
    requestContext?: BalanceEventInput["requestContext"];
  }) {
    const [created] = await this.db
      .insert(schema.balanceHolds)
      .values({
        bookId: input.subject.bookId,
        subjectType: input.subject.subjectType,
        subjectId: input.subject.subjectId,
        currency: input.subject.currency,
        holdRef: input.holdRef,
        amountMinor: input.amountMinor,
        state: input.state,
        reason: input.reason ?? null,
        actorId: input.actorId ?? null,
        requestId: input.requestContext?.requestId ?? null,
        correlationId: input.requestContext?.correlationId ?? null,
        traceId: input.requestContext?.traceId ?? null,
        causationId: input.requestContext?.causationId ?? null,
      })
      .returning();

    if (!created) {
      throw new LedgerError("Balance hold insert failed");
    }

    return toBalanceHoldRecord(created);
  }

  private async doUpdateHold(holdId: string, update: BalanceHoldUpdate) {
    const [updated] = await this.db
      .update(schema.balanceHolds)
      .set({
        state: update.state,
        reason: update.reason,
        actorId: update.actorId,
        releasedAt:
          update.releasedAt === undefined ? undefined : update.releasedAt,
        consumedAt:
          update.consumedAt === undefined ? undefined : update.consumedAt,
      })
      .where(eq(schema.balanceHolds.id, holdId))
      .returning();

    if (!updated) {
      throw new LedgerError("Balance hold update failed");
    }

    return toBalanceHoldRecord(updated);
  }

  private async doAppendBalanceEvent(input: BalanceEventInput) {
    await this.db.insert(schema.balanceEvents).values({
      bookId: input.subject.bookId,
      subjectType: input.subject.subjectType,
      subjectId: input.subject.subjectId,
      currency: input.subject.currency,
      eventType: input.eventType,
      holdRef: input.holdRef ?? null,
      operationId: input.operationId ?? null,
      deltaAvailable: input.deltaAvailable ?? 0n,
      deltaReserved: input.deltaReserved ?? 0n,
      deltaPending: input.deltaPending ?? 0n,
      deltaLedgerBalance: input.deltaLedgerBalance ?? 0n,
      meta: input.meta ?? null,
      actorId: input.actorId ?? null,
      requestId: input.requestContext?.requestId ?? null,
      correlationId: input.requestContext?.correlationId ?? null,
      traceId: input.requestContext?.traceId ?? null,
      causationId: input.requestContext?.causationId ?? null,
    });

    await pgNotify(
      this.db,
      "balance_changed",
      JSON.stringify({
        bookId: input.subject.bookId,
        subjectType: input.subject.subjectType,
        subjectId: input.subject.subjectId,
        currency: input.subject.currency,
        version: input.version ?? null,
        eventType: input.eventType,
      }),
    );
  }

  private async doLoadMutationReplayResult(
    subject: BalanceSubjectInput,
    holdRef?: string | null,
  ) {
    const position =
      (await this.selectBalancePosition(subject, false)) ??
      createZeroBalanceSnapshot(subject);
    const hold = holdRef
      ? await this.selectHold(subject, holdRef, false)
      : null;

    return {
      balance: position,
      hold: toBalanceHoldSnapshot(hold),
    };
  }
}
