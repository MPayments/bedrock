import { z } from "zod";

import { COUNTRY_ALPHA2_SET } from "@bedrock/reference-data/countries";

export const PARTY_KIND_VALUES = ["legal_entity", "individual"] as const;

export const PartyKindSchema = z.enum(PARTY_KIND_VALUES);
export type PartyKind = z.infer<typeof PartyKindSchema>;

export const CountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => COUNTRY_ALPHA2_SET.has(value),
    "country must be a valid ISO 3166-1 alpha-2 code",
  );
export type CountryCode = z.infer<typeof CountryCodeSchema>;
