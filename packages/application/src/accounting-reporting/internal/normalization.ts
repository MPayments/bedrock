export function toBigInt(value: unknown): bigint {
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

export function normalizeCurrency(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.trim().toUpperCase();
}

export function normalizeMonthStart(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

export function toJsonSafeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, toJsonSafeValue(nested)]),
    );
  }

  return value;
}

export function toDateValue(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(typeof value === "string" ? value : String(value));
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}
