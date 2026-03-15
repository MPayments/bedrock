import { z } from "zod";

import { normalizeCountryCode } from "../domain/country-code";
import { REQUISITE_KIND_VALUES } from "../domain/requisite-kind";

export { REQUISITE_KIND_VALUES };

export const RequisiteKindSchema = z.enum(REQUISITE_KIND_VALUES);
export type RequisiteKind = z.infer<typeof RequisiteKindSchema>;

export const CountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => normalizeCountryCode(value) ?? "");
