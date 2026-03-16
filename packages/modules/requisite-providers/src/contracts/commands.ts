import { z } from "zod";

import {
  DomainError,
  readCauseString,
  trimToNull,
} from "@bedrock/shared/core/domain";

import { CountryCodeSchema, RequisiteKindSchema } from "./zod";
import { validateRequisiteProviderDetails } from "../domain/requisite-provider";

const nullableText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);
const nullableShortText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => trimToNull(value) ?? null);
const nullableCountry = CountryCodeSchema.nullish().transform(
  (value) => value ?? null,
);
const nullableTextPatch = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .transform((value) => trimToNull(value))
  .exactOptional();
const nullableShortTextPatch = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .transform((value) => trimToNull(value))
  .exactOptional();
const nullableCountryPatch = CountryCodeSchema.nullable().exactOptional();

const providerFieldsSchema = z.object({
  kind: RequisiteKindSchema,
  name: z.string().trim().min(1).max(255),
  description: nullableText,
  country: nullableCountry,
  address: nullableText,
  contact: nullableText,
  bic: nullableShortText,
  swift: nullableShortText,
});

function refineProviderRules(
  value: {
    kind: string;
    country: string | null;
    bic: string | null;
    swift: string | null;
  },
  ctx: z.RefinementCtx,
) {
  try {
    validateRequisiteProviderDetails({
      kind: value.kind as never,
      name: "validated",
      description: null,
      country: value.country,
      address: null,
      contact: null,
      bic: value.bic,
      swift: value.swift,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      ctx.addIssue({
        code: "custom",
        path: [readCauseString(error, "field") ?? "kind"],
        message: error.message,
      });
      return;
    }

    throw error;
  }
}

export const CreateRequisiteProviderInputSchema =
  providerFieldsSchema.superRefine(refineProviderRules);
export type CreateRequisiteProviderInput = z.input<
  typeof CreateRequisiteProviderInputSchema
>;

export const UpdateRequisiteProviderInputSchema = z.object({
  kind: RequisiteKindSchema.exactOptional(),
  name: z.string().trim().min(1).max(255).exactOptional(),
  description: nullableTextPatch,
  country: nullableCountryPatch,
  address: nullableTextPatch,
  contact: nullableTextPatch,
  bic: nullableShortTextPatch,
  swift: nullableShortTextPatch,
});
export type UpdateRequisiteProviderInput = z.input<
  typeof UpdateRequisiteProviderInputSchema
>;
