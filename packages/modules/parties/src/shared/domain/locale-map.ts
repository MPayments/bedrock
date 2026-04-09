import { z } from "zod";

export type LocaleTextMap = Record<string, string | null>;

function normalizeLocaleKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLocaleValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeLocaleTextMap(
  value: Record<string, string | null | undefined> | null | undefined,
): LocaleTextMap | null {
  if (!value) {
    return null;
  }

  const out: LocaleTextMap = {};

  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = normalizeLocaleKey(rawKey);
    const normalizedValue = normalizeLocaleValue(rawValue);

    if (!key || normalizedValue === null) {
      continue;
    }

    out[key] = normalizedValue;
  }

  return Object.keys(out).length > 0 ? out : null;
}

export const LocaleTextMapSchema = z
  .record(z.string(), z.string().nullable())
  .nullish()
  .transform((value) => normalizeLocaleTextMap(value) ?? null);

