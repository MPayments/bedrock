import { COUNTRIES, type CountryRecord } from "@bedrock/countries";

type CounterpartyCountryOption = {
  value: string;
  label: string;
  search: string;
};

const COUNTRY_BY_ALPHA2 = new Map(
  COUNTRIES.map((country) => [country.alpha2, country]),
);

function formatCountryLabel(
  country: Pick<CountryRecord, "emoji" | "name">,
): string {
  return `${country.emoji} ${country.name}`;
}

export const COUNTERPARTY_COUNTRY_OPTIONS: CounterpartyCountryOption[] =
  COUNTRIES.map((country) => ({
    value: country.alpha2,
    label: formatCountryLabel(country),
    search: `${country.alpha2} ${country.alpha3} ${country.name}`.toLowerCase(),
  })).sort((a, b) => a.label.localeCompare(b.label));

export function getCountryPresentation(code: string | null | undefined): {
  code: string;
  label: string;
} | null {
  if (!code) {
    return null;
  }

  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const country = COUNTRY_BY_ALPHA2.get(normalized);
  if (!country) {
    return null;
  }

  return {
    code: country.alpha2,
    label: formatCountryLabel(country),
  };
}
