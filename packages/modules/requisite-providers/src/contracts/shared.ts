import { z } from "zod";

import { COUNTRY_ALPHA2_SET } from "@bedrock/shared/reference-data/countries";

export const REQUISITE_KIND_VALUES = [
  "bank",
  "blockchain",
  "exchange",
  "custodian",
] as const;

export const RequisiteKindSchema = z.enum(REQUISITE_KIND_VALUES);
export type RequisiteKind = z.infer<typeof RequisiteKindSchema>;

export const CountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => COUNTRY_ALPHA2_SET.has(value),
    "country must be a valid ISO 3166-1 alpha-2 code",
  );
