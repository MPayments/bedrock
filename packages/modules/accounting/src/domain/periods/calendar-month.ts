import { ValueObject, invariant } from "@bedrock/shared/core/domain";

export class CalendarMonth extends ValueObject<{
  year: number;
  month: number;
}> {
  private constructor(
    year: number,
    month: number,
  ) {
    super({ year, month });
  }

  static fromDate(input: Date): CalendarMonth {
    invariant(
      !Number.isNaN(input.getTime()),
      "calendar_month.invalid_date",
      "Calendar month requires a valid date",
      { input },
    );

    return new CalendarMonth(input.getUTCFullYear(), input.getUTCMonth());
  }

  get start(): Date {
    return new Date(
      Date.UTC(this.props.year, this.props.month, 1, 0, 0, 0, 0),
    );
  }

  get endExclusive(): Date {
    return new Date(
      Date.UTC(this.props.year, this.props.month + 1, 1, 0, 0, 0, 0),
    );
  }

  get label(): string {
    return this.start.toISOString().slice(0, 7);
  }

  previous(): CalendarMonth {
    return CalendarMonth.fromDate(
      new Date(Date.UTC(this.props.year, this.props.month - 1, 1, 0, 0, 0, 0)),
    );
  }
}

export function normalizeMonthStart(input: Date): Date {
  return CalendarMonth.fromDate(input).start;
}

export function normalizeMonthEndExclusive(input: Date): Date {
  return CalendarMonth.fromDate(input).endExclusive;
}

export function formatPeriodLabel(periodStart: Date): string {
  return CalendarMonth.fromDate(periodStart).label;
}

export function getPreviousCalendarMonthRange(now: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const previousMonth = CalendarMonth.fromDate(now).previous();

  return {
    periodStart: previousMonth.start,
    periodEnd: previousMonth.endExclusive,
  };
}
