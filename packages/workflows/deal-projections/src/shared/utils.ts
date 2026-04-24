import {
  minorToAmountString,
  toMinorAmountString,
} from "@bedrock/shared/money";

export function parseOptionalSet(value?: string): Set<string> | null {
  if (!value) {
    return null;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? new Set(items) : null;
}

export function parseDecimalOrZero(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseMinorOrZero(
  value: string | bigint | null | undefined,
  precision: number | null | undefined,
): number {
  if (value == null || precision == null) {
    return 0;
  }

  return parseDecimalOrZero(minorToAmountString(value, { precision }));
}

export function toMinorOrZero(
  value: string | null | undefined,
  currencyCode: string,
): bigint {
  return BigInt(toMinorAmountString(value ?? "0", currencyCode));
}

export function compareBigInt(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

export function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return (left ?? "").localeCompare(right ?? "", "ru");
}

export function compareNullableDates(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const leftValue = left ? new Date(left).getTime() : 0;
  const rightValue = right ? new Date(right).getTime() : 0;
  return leftValue - rightValue;
}

export function toMap<K, V>(
  entries: readonly (readonly [K, V])[],
): Map<K, V> {
  return new Map(entries);
}

export function toDateOrNull(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function getDateTimeValue(value: Date | string | null | undefined) {
  const date = toDateOrNull(value);
  return date?.getTime() ?? 0;
}

export function matchesTextFilter(
  value: string | null | undefined,
  filter: string | undefined,
) {
  if (!filter) {
    return true;
  }

  const normalizedValue = (value ?? "").toLowerCase();
  const normalizedFilter = filter.toLowerCase();
  return normalizedValue.includes(normalizedFilter);
}
