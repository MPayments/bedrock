export function normalizeMonthStart(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

export function normalizeMonthEndExclusive(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}

export function formatPeriodLabel(periodStart: Date): string {
  return periodStart.toISOString().slice(0, 7);
}

export function getPreviousCalendarMonthRange(now: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const currentMonthStart = normalizeMonthStart(now);
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

  return {
    periodStart,
    periodEnd: currentMonthStart,
  };
}
