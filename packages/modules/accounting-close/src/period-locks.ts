import { and, eq } from "drizzle-orm";

import type { Database, Transaction } from "@bedrock/persistence";

import { ValidationError } from "@bedrock/core/errors";

import { schema } from "./schema";

type Queryable = Database | Transaction;

const ORGANIZATION_ID_PAYLOAD_KEYS = [
  "organizationId",
  "sourceOrganizationId",
  "destinationOrganizationId",
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

function readOrganizationIdsFromPayload(
  payload: Record<string, unknown> | null | undefined,
): string[] {
  if (!payload) {
    return [];
  }
  const ids = ORGANIZATION_ID_PAYLOAD_KEYS.flatMap((key) => {
    const value = payload[key];
    return typeof value === "string" && value.trim().length > 0 ? [value] : [];
  });
  return [...new Set(ids)];
}

export function collectDocumentOrganizationIds(input: {
  payload?: Record<string, unknown> | null;
}): string[] {
  return readOrganizationIdsFromPayload(input.payload).filter(
    (value) => value.trim().length > 0,
  );
}

export async function isOrganizationPeriodClosed(input: {
  db: Queryable;
  organizationId: string;
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
        eq(schema.accountingPeriodLocks.organizationId, input.organizationId),
        eq(schema.accountingPeriodLocks.periodStart, periodStart),
        eq(schema.accountingPeriodLocks.state, "closed"),
      ),
    )
    .limit(1);

  return Boolean(lock);
}

export async function assertOrganizationPeriodsOpen(input: {
  db: Queryable;
  occurredAt: Date;
  organizationIds: string[];
  docType: string;
}): Promise<void> {
  if (input.organizationIds.length === 0) {
    return;
  }

  const periodStart = normalizeToMonthStart(input.occurredAt);
  const periodLabel = formatPeriodLabel(periodStart);

  for (const organizationId of input.organizationIds) {
    const closed = await isOrganizationPeriodClosed({
      db: input.db,
      organizationId,
      occurredAt: input.occurredAt,
    });
    if (!closed) {
      continue;
    }
    throw new ValidationError(
      `Accounting period ${periodLabel} is closed for organization ${organizationId}; ${input.docType} cannot be mutated`,
    );
  }
}

export async function closeOrganizationPeriod(input: {
  db: Queryable;
  organizationId: string;
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
      organizationId: input.organizationId,
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
        schema.accountingPeriodLocks.organizationId,
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

export async function reopenOrganizationPeriod(input: {
  db: Queryable;
  organizationId: string;
  periodStart: Date;
  reopenedBy: string;
  reopenReason?: string | null;
}) {
  const periodStart = normalizeToMonthStart(input.periodStart);

  const [row] = await input.db
    .insert(schema.accountingPeriodLocks)
    .values({
      organizationId: input.organizationId,
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
        schema.accountingPeriodLocks.organizationId,
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
