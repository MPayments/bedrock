export function toAmountMinor(value: unknown): bigint | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function firstString(
  input: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}
