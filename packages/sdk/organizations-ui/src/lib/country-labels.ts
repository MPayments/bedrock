import { COUNTRIES } from "@bedrock/shared/reference-data/countries";

const COUNTRY_BY_ALPHA2 = new Map(
  COUNTRIES.map((country) => [country.alpha2, country]),
);

export function getCountryLabel(code: string | null): string {
  if (!code) {
    return "\u2014";
  }

  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return "\u2014";
  }

  const country = COUNTRY_BY_ALPHA2.get(normalizedCode);
  if (!country) {
    return normalizedCode;
  }

  return `${country.emoji} ${country.name}`;
}

export const COUNTRY_FILTER_OPTIONS = COUNTRIES.map((country) => ({
  value: country.alpha2,
  label: `${country.emoji} ${country.name}`,
})).sort((a, b) => a.label.localeCompare(b.label));
