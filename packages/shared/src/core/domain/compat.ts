import { DomainError } from "./domain-error";

export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export function brandId<TBrand extends string>(
  value: string,
): Brand<string, TBrand> {
  return value as Brand<string, TBrand>;
}

export function dedupeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}

export function trimToNull(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  return trimToNull(value);
}

export function normalizeRequiredText(
  value: string,
  code = "value.required",
  field = "value",
): string {
  const normalized = trimToNull(value);

  if (normalized === null) {
    throw new DomainError(`${field} is required`, {
      code,
      meta: { field },
    });
  }

  return normalized;
}

export function readCauseString(
  error: { meta?: Readonly<Record<string, unknown>> | undefined },
  key: string,
): string | undefined {
  const value = error.meta?.[key];
  return typeof value === "string" ? value : undefined;
}
