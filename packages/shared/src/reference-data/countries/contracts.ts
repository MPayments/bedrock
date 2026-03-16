import countriesJson from "./countries.json" with { type: "json" };

export const COUNTRY_ALPHA2_CODES = countriesJson
  .map((country) => country.alpha2)
  .sort() as [string, ...string[]];

export const COUNTRY_ALPHA2_SET = new Set<string>(COUNTRY_ALPHA2_CODES);
