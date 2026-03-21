import { normalizeOptionalCountryCode } from "../../shared/domain/party-kind";

export type CountryCodeValue = string;

export function normalizeCountryCode(
  value: string | null | undefined,
): string | null {
  return normalizeOptionalCountryCode(value);
}
