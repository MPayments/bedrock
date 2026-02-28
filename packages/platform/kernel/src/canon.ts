function canonicalize(value: unknown): unknown {
  if (typeof value === "undefined") {
    throw new TypeError("canonicalJson does not support undefined values");
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }

  if (value instanceof Map) {
    return canonicalize(Object.fromEntries(value.entries()));
  }

  if (value instanceof Set) {
    return canonicalize(Array.from(value.values()));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => typeof entryValue !== "undefined")
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entryValue]) => [key, canonicalize(entryValue)] as const);

    return Object.fromEntries(entries);
  }

  throw new TypeError(`canonicalJson does not support value of type ${typeof value}`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/**
 * Backward-compatible alias kept for existing callers.
 */
export function stableStringify(value: unknown): string {
  return canonicalJson(value);
}

export function makePlanKey(
  operation: string,
  payload: Record<string, unknown>,
): string {
  return `${operation}:${canonicalJson(payload)}`;
}
