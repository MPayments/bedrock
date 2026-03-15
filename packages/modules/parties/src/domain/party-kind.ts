import { DomainError } from "@bedrock/shared/core/domain";
import { COUNTRY_ALPHA2_SET } from "@bedrock/shared/reference-data/countries";

export const PARTY_KIND_VALUES = ["legal_entity", "individual"] as const;

export type PartyKind = (typeof PARTY_KIND_VALUES)[number];
export type CountryCode = string;

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isCountryCode(value: string): boolean {
  return COUNTRY_ALPHA2_SET.has(normalizeCountryCode(value));
}

export function parseCountryCode(value: string): CountryCode {
  const normalized = normalizeCountryCode(value);

  if (!COUNTRY_ALPHA2_SET.has(normalized)) {
    throw new DomainError(
      "country.invalid",
      `country must be a valid ISO 3166-1 alpha-2 code: ${value}`,
      { value },
    );
  }

  return normalized;
}
