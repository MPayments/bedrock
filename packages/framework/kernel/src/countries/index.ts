import countriesJson from "./countries.json" with { type: "json" };

export interface CountryRecord {
  alpha2: string;
  alpha3: string;
  currencies: string[];
  emoji: string;
  ioc: string;
  name: string;
}

export const COUNTRIES = countriesJson as CountryRecord[];

const COUNTRY_BY_ALPHA2 = new Map(
  COUNTRIES.map((country) => [country.alpha2, country]),
);

const COUNTRY_BY_ALPHA3 = new Map(
  COUNTRIES.map((country) => [country.alpha3, country]),
);

const ENGLISH_REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

const NAME_TO_ALPHA2 = new Map<string, string>();

for (const country of COUNTRIES) {
  NAME_TO_ALPHA2.set(normalizeCountryLookupValue(country.name), country.alpha2);

  const englishName = ENGLISH_REGION_NAMES.of(country.alpha2);
  if (
    englishName &&
    englishName !== country.alpha2 &&
    englishName !== "Unknown Region"
  ) {
    NAME_TO_ALPHA2.set(
      normalizeCountryLookupValue(englishName),
      country.alpha2,
    );
  }
}

export const COUNTRY_ALPHA2_SET = new Set(
  COUNTRIES.map((country) => country.alpha2),
);

function normalizeCountryLookupValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function getCountryByAlpha2(code: string): CountryRecord | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return COUNTRY_BY_ALPHA2.get(normalized) ?? null;
}

export function isValidAlpha2(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  return COUNTRY_ALPHA2_SET.has(normalized);
}

export function normalizeToAlpha2(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();

  if (COUNTRY_ALPHA2_SET.has(upper)) {
    return upper;
  }

  const byAlpha3 = COUNTRY_BY_ALPHA3.get(upper);
  if (byAlpha3) {
    return byAlpha3.alpha2;
  }

  const byName = NAME_TO_ALPHA2.get(normalizeCountryLookupValue(raw));
  return byName ?? null;
}
