import { invariant } from "@bedrock/shared/core/domain";
import { CountryCodeValue } from "@bedrock/shared/requisites";

export function normalizeCountryCode(
  country: string | null | undefined,
): string | null {
  if (country == null) {
    return null;
  }

  const normalized = CountryCodeValue.normalize(country);
  if (normalized.length === 0) {
    return null;
  }

  invariant(
    CountryCodeValue.is(normalized),
    "requisite_provider.country.invalid",
    "country must be a valid ISO 3166-1 alpha-2 code",
    { field: "country", value: country },
  );

  return CountryCodeValue.create(normalized).value;
}

export { CountryCodeValue };
