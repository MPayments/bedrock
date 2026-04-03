import { z } from "zod";

import { invariant } from "@bedrock/shared/core/domain";
import { COUNTRY_ALPHA2_CODES } from "@bedrock/shared/reference-data/countries/contracts";

export const PARTY_KIND_VALUES = ["legal_entity", "individual"] as const;

export type PartyKind = (typeof PARTY_KIND_VALUES)[number];
export const PartyKindSchema = z.enum(PARTY_KIND_VALUES);

const COUNTRY_ALPHA2_SET = new Set<string>(COUNTRY_ALPHA2_CODES);

export type CountryCode = string;

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isCountryCode(value: string): value is CountryCode {
  return COUNTRY_ALPHA2_SET.has(normalizeCountryCode(value));
}

export function normalizeOptionalCountryCode(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = normalizeCountryCode(value);
  return normalized.length > 0 ? normalized : null;
}

export function parseCountryCode(value: string): CountryCode {
  const normalized = normalizeCountryCode(value);
  invariant(
    isCountryCode(normalized),
    "country must be a valid ISO 3166-1 alpha-2 code",
    {
      code: "party.country_invalid",
      meta: { value },
    },
  );

  return normalized;
}

export function parseOptionalCountryCode(
  value: string | null | undefined,
): CountryCode | null {
  const normalized = normalizeOptionalCountryCode(value);
  return normalized ? parseCountryCode(normalized) : null;
}

export const CountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => normalizeCountryCode(value))
  .refine(
    (value) => isCountryCode(value),
    "country must be a valid ISO 3166-1 alpha-2 code",
  );
