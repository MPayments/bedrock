import { invariant } from "@bedrock/shared/core/domain";
import { COUNTRY_ALPHA2_SET } from "@bedrock/shared/reference-data/countries";

export function normalizeCountryCode(
  country: string | null | undefined,
): string | null {
  if (country == null) {
    return null;
  }

  const normalized = country.trim().toUpperCase();
  if (normalized.length === 0) {
    return null;
  }

  invariant(
    COUNTRY_ALPHA2_SET.has(normalized),
    "requisite_provider.country.invalid",
    "country must be a valid ISO 3166-1 alpha-2 code",
    { field: "country", value: country },
  );

  return normalized;
}
