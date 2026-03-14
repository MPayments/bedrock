import type { Dimensions } from "@bedrock/ledger/contracts";

export interface ProjectedBalanceDelta {
  bookId: string;
  subjectType: string;
  subjectId: string;
  currency: string;
  deltaLedgerBalance: bigint;
  deltaAvailable: bigint;
}

export interface BalancesWorkerOperationContext {
  operationId: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  bookIds: string[];
}

export type BalancesWorkerOperationGuard = (
  input: BalancesWorkerOperationContext,
) => Promise<boolean> | boolean;

export interface ProjectionOperationRow {
  id: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  postedAt: Date;
}

export interface ProjectionPostingRow {
  operationId: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  lineNo: number;
  bookId: string;
  currency: string;
  amountMinor: bigint;
  postingCode: string;
  debitDimensions: Dimensions | null;
  creditDimensions: Dimensions | null;
}

export interface BalanceProjectorCursor {
  workerKey: string;
  lastPostedAt: Date | null;
  lastOperationId: string | null;
}

function camelToSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

export function hasConsistentCursor(cursor: BalanceProjectorCursor) {
  return (
    (cursor.lastPostedAt === null && cursor.lastOperationId === null) ||
    (cursor.lastPostedAt !== null && cursor.lastOperationId !== null)
  );
}

export function projectBalanceSubjects(
  dimensions: Dimensions | null | undefined,
): { subjectType: string; subjectId: string }[] {
  if (!dimensions) {
    return [];
  }

  const subjects: { subjectType: string; subjectId: string }[] = [];
  for (const [key, value] of Object.entries(dimensions)) {
    if (
      !key.endsWith("Id") ||
      typeof value !== "string" ||
      value.length === 0
    ) {
      continue;
    }

    subjects.push({
      subjectType: camelToSnake(key.slice(0, -2)),
      subjectId: value,
    });
  }

  return subjects;
}

export function buildProjectedBalanceDeltas(
  rows: ProjectionPostingRow[],
): ProjectedBalanceDelta[] {
  const aggregated = new Map<string, ProjectedBalanceDelta>();

  const applyDelta = (
    bookId: string,
    currency: string,
    subjectType: string,
    subjectId: string,
    amount: bigint,
  ) => {
    const key = `${bookId}:${currency}:${subjectType}:${subjectId}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.deltaLedgerBalance += amount;
      existing.deltaAvailable += amount;
      return;
    }

    aggregated.set(key, {
      bookId,
      currency,
      subjectType,
      subjectId,
      deltaLedgerBalance: amount,
      deltaAvailable: amount,
    });
  };

  for (const row of rows) {
    for (const subject of projectBalanceSubjects(row.debitDimensions)) {
      applyDelta(
        row.bookId,
        row.currency,
        subject.subjectType,
        subject.subjectId,
        row.amountMinor,
      );
    }

    for (const subject of projectBalanceSubjects(row.creditDimensions)) {
      applyDelta(
        row.bookId,
        row.currency,
        subject.subjectType,
        subject.subjectId,
        -row.amountMinor,
      );
    }
  }

  return Array.from(aggregated.values()).filter(
    (delta) => delta.deltaLedgerBalance !== 0n || delta.deltaAvailable !== 0n,
  );
}
