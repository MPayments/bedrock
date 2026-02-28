import { and, eq, inArray, sql } from "drizzle-orm";

import type { Transaction } from "@bedrock/db";
import {
  schema,
  type BalanceHold,
  type BalancePosition,
} from "@bedrock/db/schema";
import { IDEMPOTENCY_SCOPE } from "@bedrock/idempotency";
import type { CorrelationContext } from "@bedrock/kernel";

import {
  BalanceHoldConflictError,
  BalanceHoldNotFoundError,
  BalanceHoldStateError,
  InsufficientAvailableBalanceError,
} from "./errors";
import {
  createBalancesServiceContext,
  type BalancesServiceDeps,
} from "./internal/context";
import {
  validateBalanceSubject,
  validateConsumeBalanceInput,
  validateReleaseBalanceInput,
  validateReserveBalanceInput,
  type BalanceSubjectInput,
} from "./validation";

export interface BalanceSnapshot {
  bookId: string;
  subjectType: string;
  subjectId: string;
  currency: string;
  ledgerBalance: bigint;
  available: bigint;
  reserved: bigint;
  pending: bigint;
  version: number;
}

export interface BalanceHoldSnapshot {
  id: string;
  holdRef: string;
  amountMinor: bigint;
  state: string;
  reason: string | null;
  createdAt: Date;
  releasedAt: Date | null;
  consumedAt: Date | null;
}

export interface BalanceMutationResult {
  balance: BalanceSnapshot;
  hold: BalanceHoldSnapshot | null;
}

export interface OperationalAccountBalanceSnapshot {
  operationalAccountId: string;
  currency: string;
  balanceMinor: bigint;
  precision: number;
}

function toBalanceSnapshot(
  position: Pick<
    BalancePosition,
    | "bookId"
    | "subjectType"
    | "subjectId"
    | "currency"
    | "ledgerBalance"
    | "available"
    | "reserved"
    | "pending"
    | "version"
  >,
): BalanceSnapshot {
  return {
    bookId: position.bookId,
    subjectType: position.subjectType,
    subjectId: position.subjectId,
    currency: position.currency,
    ledgerBalance: position.ledgerBalance,
    available: position.available,
    reserved: position.reserved,
    pending: position.pending,
    version: position.version,
  };
}

function toHoldSnapshot(hold: BalanceHold | null): BalanceHoldSnapshot | null {
  if (!hold) {
    return null;
  }

  return {
    id: hold.id,
    holdRef: hold.holdRef,
    amountMinor: hold.amountMinor,
    state: hold.state,
    reason: hold.reason,
    createdAt: hold.createdAt,
    releasedAt: hold.releasedAt,
    consumedAt: hold.consumedAt,
  };
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  if (typeof value === "string") {
    return BigInt(value);
  }

  return 0n;
}

async function ensureBalancePositionTx(
  tx: Transaction,
  subject: BalanceSubjectInput,
): Promise<BalancePosition> {
  const existing = await getBalancePositionTx(tx, subject, true);
  if (existing) {
    return existing;
  }

  await tx
    .insert(schema.balancePositions)
    .values({
      bookId: subject.bookId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      currency: subject.currency,
    })
    .onConflictDoNothing();

  const created = await getBalancePositionTx(tx, subject, true);
  if (!created) {
    throw new Error("Failed to initialize balance position");
  }

  return created;
}

async function getBalancePositionTx(
  tx: Transaction,
  subject: BalanceSubjectInput,
  forUpdate = false,
): Promise<BalancePosition | null> {
  const query = tx
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

  const rows = forUpdate ? await query.for("update") : await query;
  return rows[0] ?? null;
}

async function getHoldTx(
  tx: Transaction,
  subject: BalanceSubjectInput,
  holdRef: string,
  forUpdate = false,
): Promise<BalanceHold | null> {
  const query = tx
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

  const rows = forUpdate ? await query.for("update") : await query;
  return rows[0] ?? null;
}

async function writeBalanceEventTx(
  tx: Transaction,
  input: {
    subject: BalanceSubjectInput;
    eventType: string;
    holdRef?: string | null;
    deltaAvailable?: bigint;
    deltaReserved?: bigint;
    deltaPending?: bigint;
    deltaLedgerBalance?: bigint;
    actorId?: string | null;
    requestContext?: CorrelationContext;
    meta?: Record<string, unknown> | null;
  },
): Promise<void> {
  await tx.insert(schema.balanceEvents).values({
    bookId: input.subject.bookId,
    subjectType: input.subject.subjectType,
    subjectId: input.subject.subjectId,
    currency: input.subject.currency,
    eventType: input.eventType,
    holdRef: input.holdRef ?? null,
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
}

async function updateBalancePositionTx(
  tx: Transaction,
  input: {
    subject: BalanceSubjectInput;
    deltaAvailable?: bigint;
    deltaReserved?: bigint;
    deltaPending?: bigint;
    deltaLedgerBalance?: bigint;
  },
): Promise<BalancePosition> {
  const [updated] = await tx
    .update(schema.balancePositions)
    .set({
      available: sql`${schema.balancePositions.available} + ${input.deltaAvailable ?? 0n}`,
      reserved: sql`${schema.balancePositions.reserved} + ${input.deltaReserved ?? 0n}`,
      pending: sql`${schema.balancePositions.pending} + ${input.deltaPending ?? 0n}`,
      ledgerBalance: sql`${schema.balancePositions.ledgerBalance} + ${input.deltaLedgerBalance ?? 0n}`,
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
    throw new Error("Balance position update failed");
  }

  return updated;
}

async function loadMutationReplayResult(
  tx: Transaction,
  subject: BalanceSubjectInput,
  holdRef?: string | null,
): Promise<BalanceMutationResult> {
  const position = (await getBalancePositionTx(tx, subject)) ?? {
    bookId: subject.bookId,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    currency: subject.currency,
    ledgerBalance: 0n,
    available: 0n,
    reserved: 0n,
    pending: 0n,
    version: 1,
  };
  const hold = holdRef ? await getHoldTx(tx, subject, holdRef) : null;

  return {
    balance: toBalanceSnapshot(position),
    hold: toHoldSnapshot(hold),
  };
}

export type BalancesService = ReturnType<typeof createBalancesService>;

export function createBalancesService(deps: BalancesServiceDeps) {
  const context = createBalancesServiceContext(deps);
  const { db, idempotency } = context;

  async function getBalance(subjectInput: unknown): Promise<BalanceSnapshot> {
    const subject = validateBalanceSubject(subjectInput);
    const position = await getBalancePositionTx(
      db as unknown as Transaction,
      subject,
    );

    if (!position) {
      return {
        bookId: subject.bookId,
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        currency: subject.currency,
        ledgerBalance: 0n,
        available: 0n,
        reserved: 0n,
        pending: 0n,
        version: 1,
      };
    }

    return toBalanceSnapshot(position);
  }

  async function listBalancesByOperationalAccountIds(
    accountIds: string[],
  ): Promise<OperationalAccountBalanceSnapshot[]> {
    const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        operationalAccountId: schema.balancePositions.subjectId,
        currency: schema.balancePositions.currency,
        balanceMinor:
          sql<string>`coalesce(sum(${schema.balancePositions.ledgerBalance}), 0)::text`,
      })
      .from(schema.balancePositions)
      .where(
        and(
          eq(schema.balancePositions.subjectType, "operational_account"),
          inArray(schema.balancePositions.subjectId, uniqueIds),
        ),
      )
      .groupBy(
        schema.balancePositions.subjectId,
        schema.balancePositions.currency,
      );

    const currencyCodes = Array.from(new Set(rows.map((row) => row.currency)));
    const currencyRows =
      currencyCodes.length === 0
        ? []
        : await db
            .select({
              code: schema.currencies.code,
              precision: schema.currencies.precision,
            })
            .from(schema.currencies)
            .where(inArray(schema.currencies.code, currencyCodes));
    const precisionByCode = new Map(
      currencyRows.map((row) => [row.code, row.precision]),
    );

    return rows.map((row) => ({
      operationalAccountId: row.operationalAccountId,
      currency: row.currency,
      balanceMinor: toBigInt(row.balanceMinor),
      precision: precisionByCode.get(row.currency) ?? 2,
    }));
  }

  async function reserve(input: {
    subject: BalanceSubjectInput;
    amountMinor: bigint;
    holdRef: string;
    reason?: string;
    actorId?: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }): Promise<BalanceMutationResult> {
    const validated = validateReserveBalanceInput(input);

    return db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.BALANCES_RESERVE,
        idempotencyKey: input.idempotencyKey,
        request: validated,
        actorId: validated.actorId,
        serializeResult: () => ({
          holdRef: validated.holdRef,
          subject: validated.subject,
        }),
        loadReplayResult: async () =>
          loadMutationReplayResult(tx, validated.subject, validated.holdRef),
        handler: async () => {
          const position = await ensureBalancePositionTx(tx, validated.subject);
          const existingHold = await getHoldTx(
            tx,
            validated.subject,
            validated.holdRef,
            true,
          );

          if (existingHold) {
            if (existingHold.amountMinor !== validated.amountMinor) {
              throw new BalanceHoldConflictError(validated.holdRef);
            }

            return loadMutationReplayResult(
              tx,
              validated.subject,
              validated.holdRef,
            );
          }

          if (position.available < validated.amountMinor) {
            throw new InsufficientAvailableBalanceError(
              position.available,
              validated.amountMinor,
            );
          }

          const updatedPosition = await updateBalancePositionTx(tx, {
            subject: validated.subject,
            deltaAvailable: -validated.amountMinor,
            deltaReserved: validated.amountMinor,
          });

          const [hold] = await tx
            .insert(schema.balanceHolds)
            .values({
              bookId: validated.subject.bookId,
              subjectType: validated.subject.subjectType,
              subjectId: validated.subject.subjectId,
              currency: validated.subject.currency,
              holdRef: validated.holdRef,
              amountMinor: validated.amountMinor,
              state: "active",
              reason: validated.reason ?? null,
              actorId: validated.actorId ?? null,
              requestId: input.requestContext?.requestId ?? null,
              correlationId: input.requestContext?.correlationId ?? null,
              traceId: input.requestContext?.traceId ?? null,
              causationId: input.requestContext?.causationId ?? null,
            })
            .returning();

          await writeBalanceEventTx(tx, {
            subject: validated.subject,
            eventType: "reserve",
            holdRef: validated.holdRef,
            deltaAvailable: -validated.amountMinor,
            deltaReserved: validated.amountMinor,
            actorId: validated.actorId,
            requestContext: input.requestContext,
            meta: validated.reason ? { reason: validated.reason } : null,
          });

          return {
            balance: toBalanceSnapshot(updatedPosition),
            hold: toHoldSnapshot(hold!),
          };
        },
      }),
    );
  }

  async function release(input: {
    subject: BalanceSubjectInput;
    holdRef: string;
    reason?: string;
    actorId?: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }): Promise<BalanceMutationResult> {
    const validated = validateReleaseBalanceInput(input);

    return db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.BALANCES_RELEASE,
        idempotencyKey: input.idempotencyKey,
        request: validated,
        actorId: validated.actorId,
        serializeResult: () => ({
          holdRef: validated.holdRef,
          subject: validated.subject,
        }),
        loadReplayResult: async () =>
          loadMutationReplayResult(tx, validated.subject, validated.holdRef),
        handler: async () => {
          const hold = await getHoldTx(
            tx,
            validated.subject,
            validated.holdRef,
            true,
          );

          if (!hold) {
            throw new BalanceHoldNotFoundError(validated.holdRef);
          }

          if (hold.state === "released") {
            return loadMutationReplayResult(
              tx,
              validated.subject,
              validated.holdRef,
            );
          }
          if (hold.state !== "active") {
            throw new BalanceHoldStateError(
              validated.holdRef,
              hold.state,
              "release",
            );
          }

          await ensureBalancePositionTx(tx, validated.subject);
          const updatedPosition = await updateBalancePositionTx(tx, {
            subject: validated.subject,
            deltaAvailable: hold.amountMinor,
            deltaReserved: -hold.amountMinor,
          });

          const [updatedHold] = await tx
            .update(schema.balanceHolds)
            .set({
              state: "released",
              reason: validated.reason ?? hold.reason,
              actorId: validated.actorId ?? hold.actorId,
              releasedAt: sql`now()`,
            })
            .where(eq(schema.balanceHolds.id, hold.id))
            .returning();

          await writeBalanceEventTx(tx, {
            subject: validated.subject,
            eventType: "release",
            holdRef: validated.holdRef,
            deltaAvailable: hold.amountMinor,
            deltaReserved: -hold.amountMinor,
            actorId: validated.actorId,
            requestContext: input.requestContext,
            meta: validated.reason ? { reason: validated.reason } : null,
          });

          return {
            balance: toBalanceSnapshot(updatedPosition),
            hold: toHoldSnapshot(updatedHold!),
          };
        },
      }),
    );
  }

  async function consume(input: {
    subject: BalanceSubjectInput;
    holdRef: string;
    reason?: string;
    actorId?: string;
    idempotencyKey: string;
    requestContext?: CorrelationContext;
  }): Promise<BalanceMutationResult> {
    const validated = validateConsumeBalanceInput(input);

    return db.transaction(async (tx) =>
      idempotency.withIdempotencyTx({
        tx,
        scope: IDEMPOTENCY_SCOPE.BALANCES_CONSUME,
        idempotencyKey: input.idempotencyKey,
        request: validated,
        actorId: validated.actorId,
        serializeResult: () => ({
          holdRef: validated.holdRef,
          subject: validated.subject,
        }),
        loadReplayResult: async () =>
          loadMutationReplayResult(tx, validated.subject, validated.holdRef),
        handler: async () => {
          const hold = await getHoldTx(
            tx,
            validated.subject,
            validated.holdRef,
            true,
          );

          if (!hold) {
            throw new BalanceHoldNotFoundError(validated.holdRef);
          }

          if (hold.state === "consumed") {
            return loadMutationReplayResult(
              tx,
              validated.subject,
              validated.holdRef,
            );
          }
          if (hold.state !== "active") {
            throw new BalanceHoldStateError(
              validated.holdRef,
              hold.state,
              "consume",
            );
          }

          await ensureBalancePositionTx(tx, validated.subject);
          const updatedPosition = await updateBalancePositionTx(tx, {
            subject: validated.subject,
            deltaReserved: -hold.amountMinor,
            deltaPending: hold.amountMinor,
          });

          const [updatedHold] = await tx
            .update(schema.balanceHolds)
            .set({
              state: "consumed",
              reason: validated.reason ?? hold.reason,
              actorId: validated.actorId ?? hold.actorId,
              consumedAt: sql`now()`,
            })
            .where(eq(schema.balanceHolds.id, hold.id))
            .returning();

          await writeBalanceEventTx(tx, {
            subject: validated.subject,
            eventType: "consume",
            holdRef: validated.holdRef,
            deltaReserved: -hold.amountMinor,
            deltaPending: hold.amountMinor,
            actorId: validated.actorId,
            requestContext: input.requestContext,
            meta: validated.reason ? { reason: validated.reason } : null,
          });

          return {
            balance: toBalanceSnapshot(updatedPosition),
            hold: toHoldSnapshot(updatedHold!),
          };
        },
      }),
    );
  }

  return {
    getBalance,
    listBalancesByOperationalAccountIds,
    reserve,
    release,
    consume,
  };
}
