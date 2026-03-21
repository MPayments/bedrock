import { DomainError } from "./domain-error";

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export function brandId<TBrand extends string>(
  value: string,
  _brand?: TBrand,
): Brand<string, TBrand> {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainError("Id must not be empty", {
      code: "id.invalid",
      meta: { value },
    });
  }

  return normalized as Brand<string, TBrand>;
}

export function dedupeIds(ids: readonly string[]): string[] {
  const unique = new Set<string>();

  for (const id of ids) {
    const normalized = id.trim();
    if (normalized.length === 0) {
      continue;
    }

    unique.add(normalized);
  }

  return Array.from(unique);
}

export function trimToNull(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  return trimToNull(value) ?? null;
}

export function normalizeRequiredText(
  value: string,
  code = "value.required",
  field = "value",
): string {
  const normalized = trimToNull(value);

  if (normalized == null) {
    throw new DomainError(code, `${field} is required`, {
      field,
    });
  }

  return normalized;
}

export function readCauseString(
  error: {
    cause?: unknown;
    meta?: Readonly<Record<string, unknown>> | undefined;
  },
  key: string,
): string | null {
  const metaValue = error.meta?.[key];
  if (typeof metaValue === "string") {
    return metaValue;
  }

  if (
    typeof error.cause === "object" &&
    error.cause !== null &&
    key in error.cause
  ) {
    const causeValue = (error.cause as Record<string, unknown>)[key];
    return typeof causeValue === "string" ? causeValue : null;
  }

  return null;
}
