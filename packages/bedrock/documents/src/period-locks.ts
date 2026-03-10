import { and, eq } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/common/sql/ports";

import { DocumentValidationError } from "./errors";
import { schema } from "./schema";

type Queryable = Database | Transaction;

const COUNTERPARTY_ID_PAYLOAD_KEYS = [
  "counterpartyId",
  "sourceCounterpartyId",
  "destinationCounterpartyId",
  "debtorCounterpartyId",
  "creditorCounterpartyId",
] as const;

function normalizeToMonthStart(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

function normalizeToMonthEndExclusive(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

function formatPeriodLabel(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 7);
}

function readCounterpartyIdsFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string[] {
  if (!payload) {
    return [];
  }
  const ids = COUNTERPARTY_ID_PAYLOAD_KEYS.flatMap((key) => {
    const value = payload[key];
    return typeof value === "string" && value.trim().length > 0 ? [value] : [];
  });
  return [...new Set(ids)];
}

export function collectDocumentCounterpartyIds(input: {
  documentCounterpartyId?: string | null;
  payload?: Record<string, unknown> | null;
  summaryCounterpartyId?: string | null;
}): string[] {
  const ids = [
    ...(input.documentCounterpartyId ? [input.documentCounterpartyId] : []),
    ...(input.summaryCounterpartyId ? [input.summaryCounterpartyId] : []),
    ...readCounterpartyIdsFromPayload(input.payload),
  ];
  return [...new Set(ids.filter((value) => value.trim().length > 0))];
}

export async function isCounterpartyPeriodClosed(input: {
  db: Queryable;
  counterpartyId: string;
  occurredAt: Date;
}): Promise<boolean> {
  const periodStart = normalizeToMonthStart(input.occurredAt);
  const [lock] = await input.db
    .select({
      id: schema.accountingPeriodLocks.id,
    })
    .from(schema.accountingPeriodLocks)
    .where(
      and(
        eq(schema.accountingPeriodLocks.counterpartyId, input.counterpartyId),
        eq(schema.accountingPeriodLocks.periodStart, periodStart),
        eq(schema.accountingPeriodLocks.state, "closed"),
      ),
    )
    .limit(1);

  return Boolean(lock);
}

export async function assertCounterpartyPeriodsOpen(input: {
  db: Queryable;
  occurredAt: Date;
  counterpartyIds: string[];
  docType: string;
}): Promise<void> {
  if (input.counterpartyIds.length === 0) {
    return;
  }

  const periodStart = normalizeToMonthStart(input.occurredAt);
  const periodLabel = formatPeriodLabel(periodStart);

  for (const counterpartyId of input.counterpartyIds) {
    const closed = await isCounterpartyPeriodClosed({
      db: input.db,
      counterpartyId,
      occurredAt: input.occurredAt,
    });
    if (!closed) {
      continue;
    }
    throw new DocumentValidationError(
      `Accounting period ${periodLabel} is closed for counterparty ${counterpartyId}; ${input.docType} cannot be mutated`,
    );
  }
}

export async function closeCounterpartyPeriod(input: {
  db: Queryable;
  counterpartyId: string;
  periodStart: Date;
  periodEnd: Date;
  closedBy: string;
  closeReason?: string | null;
  lockedByDocumentId?: string | null;
}) {
  const periodStart = normalizeToMonthStart(input.periodStart);
  const periodEnd = normalizeToMonthEndExclusive(input.periodEnd);

  const [row] = await input.db
    .insert(schema.accountingPeriodLocks)
    .values({
      counterpartyId: input.counterpartyId,
      periodStart,
      periodEnd,
      state: "closed",
      lockedByDocumentId: input.lockedByDocumentId ?? null,
      closeReason: input.closeReason ?? null,
      closedBy: input.closedBy,
      closedAt: new Date(),
      reopenedBy: null,
      reopenReason: null,
      reopenedAt: null,
    })
    .onConflictDoUpdate({
      target: [
        schema.accountingPeriodLocks.counterpartyId,
        schema.accountingPeriodLocks.periodStart,
      ],
      set: {
        periodEnd,
        state: "closed",
        lockedByDocumentId: input.lockedByDocumentId ?? null,
        closeReason: input.closeReason ?? null,
        closedBy: input.closedBy,
        closedAt: new Date(),
        reopenedBy: null,
        reopenReason: null,
        reopenedAt: null,
      },
    })
    .returning();

  return row!;
}

export async function reopenCounterpartyPeriod(input: {
  db: Queryable;
  counterpartyId: string;
  periodStart: Date;
  reopenedBy: string;
  reopenReason?: string | null;
}) {
  const periodStart = normalizeToMonthStart(input.periodStart);

  const [row] = await input.db
    .insert(schema.accountingPeriodLocks)
    .values({
      counterpartyId: input.counterpartyId,
      periodStart,
      periodEnd: normalizeToMonthEndExclusive(periodStart),
      state: "reopened",
      lockedByDocumentId: null,
      closeReason: null,
      closedBy: null,
      closedAt: null,
      reopenedBy: input.reopenedBy,
      reopenReason: input.reopenReason ?? null,
      reopenedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.accountingPeriodLocks.counterpartyId,
        schema.accountingPeriodLocks.periodStart,
      ],
      set: {
        state: "reopened",
        reopenedBy: input.reopenedBy,
        reopenReason: input.reopenReason ?? null,
        reopenedAt: new Date(),
      },
    })
    .returning();

  return row!;
}

export function getPreviousCalendarMonthRange(now: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const currentMonthStart = normalizeToMonthStart(now);
  const periodStart = new Date(
    Date.UTC(
      currentMonthStart.getUTCFullYear(),
      currentMonthStart.getUTCMonth() - 1,
      1,
      0,
      0,
      0,
      0,
    ),
  );
  const periodEnd = currentMonthStart;

  return { periodStart, periodEnd };
}
