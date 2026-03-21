import { z } from "zod";

import { normalizeCountryCode } from "../../domain/country-code";
import {
  REQUISITE_OWNER_TYPE_VALUES,
  type RequisiteOwnerType,
} from "../../domain/owner";
import { REQUISITE_KIND_VALUES } from "../../domain/requisite-kind";

export { REQUISITE_KIND_VALUES };
export { REQUISITE_OWNER_TYPE_VALUES };

export const RequisiteKindSchema = z.enum(REQUISITE_KIND_VALUES);
export type RequisiteKind = z.infer<typeof RequisiteKindSchema>;

export const RequisiteOwnerTypeSchema = z.enum(REQUISITE_OWNER_TYPE_VALUES);
export type { RequisiteOwnerType };

export const RequisiteCountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => normalizeCountryCode(value) ?? "");
