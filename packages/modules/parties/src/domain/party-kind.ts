import { COUNTRY_ALPHA2_SET } from "@bedrock/shared/reference-data/countries";

export const PARTY_KIND_VALUES = ["legal_entity", "individual"] as const;

export function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isCountryCode(value: string): boolean {
  return COUNTRY_ALPHA2_SET.has(normalizeCountryCode(value));
}
