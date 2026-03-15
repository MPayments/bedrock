import { z } from "zod";

import { ValidationError } from "@bedrock/shared/core/errors";
import { COUNTRY_ALPHA2_SET } from "@bedrock/shared/reference-data/countries";

import { buildRequisiteOptionLabel } from "../domain/display-label";
import {
  collectRequisiteFieldIssues,
  type RequisiteFieldsInput,
} from "../domain/requisite-fields";
import { collectRequisiteProviderIssues } from "../domain/provider-rules";
import {
  REQUISITE_KIND_VALUES,
  REQUISITE_OWNER_TYPE_VALUES,
  type RequisiteKind,
  type RequisiteOwnerType,
} from "../domain/requisite-kind";

export const RequisiteKindSchema = z.enum(REQUISITE_KIND_VALUES);
export type { RequisiteKind };

export const RequisiteOwnerTypeSchema = z.enum(REQUISITE_OWNER_TYPE_VALUES);
export type { RequisiteOwnerType };

export const CountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => COUNTRY_ALPHA2_SET.has(value),
    "country must be a valid ISO 3166-1 alpha-2 code",
  );

export type RequisiteFieldsValidationInput = RequisiteFieldsInput;

export function validateRequisiteFields(input: RequisiteFieldsValidationInput) {
  const issues = collectRequisiteFieldIssues(input);
  if (issues.length > 0) {
    throw new ValidationError(issues.join("; "));
  }
}

export function buildRequisiteDisplayLabel(
  input: {
    label: string;
    currencyCode?: string | null;
  } & RequisiteFieldsValidationInput,
) {
  return buildRequisiteOptionLabel(input);
}

export function validateMergedRequisiteProviderState(input: {
  kind: string;
  country?: string | null;
  bic?: string | null;
  swift?: string | null;
}) {
  const issues = collectRequisiteProviderIssues(input);
  if (issues.length > 0) {
    throw new ValidationError(issues.join("; "));
  }
}
