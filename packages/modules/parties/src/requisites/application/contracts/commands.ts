import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { RequisiteCountryCodeSchema, RequisiteKindSchema } from "./zod";

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
const nullableCountry = RequisiteCountryCodeSchema.nullish().transform(
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
const nullableCountryPatch =
  RequisiteCountryCodeSchema.nullable().exactOptional();

const providerFieldsSchema = z.object({
  kind: RequisiteKindSchema,
  legalName: z.string().trim().min(1).max(255),
  displayName: z.string().trim().min(1).max(255),
  description: nullableText,
  country: nullableCountry,
  jurisdictionCode: nullableShortText,
  website: nullableText,
});
export const RequisiteProviderIdentifierInputSchema = z.object({
  id: z.uuid().optional(),
  scheme: z.string().trim().min(1),
  value: z.string().trim().min(1),
  isPrimary: z.boolean().default(false),
});
export type RequisiteProviderIdentifierInput = z.infer<
  typeof RequisiteProviderIdentifierInputSchema
>;
export const RequisiteProviderBranchIdentifierInputSchema =
  RequisiteProviderIdentifierInputSchema;
export type RequisiteProviderBranchIdentifierInput = z.infer<
  typeof RequisiteProviderBranchIdentifierInputSchema
>;

export const RequisiteProviderBranchInputSchema = z.object({
  id: z.uuid().optional(),
  code: nullableShortText,
  name: z.string().trim().min(1).max(255),
  country: nullableCountry,
  jurisdictionCode: nullableShortText,
  postalCode: nullableShortText,
  city: nullableShortText,
  line1: nullableText,
  line2: nullableText,
  rawAddress: nullableText,
  contactEmail: nullableShortText,
  contactPhone: nullableShortText,
  isPrimary: z.boolean().default(false),
  identifiers: z.array(RequisiteProviderBranchIdentifierInputSchema).default([]),
});
export type RequisiteProviderBranchInput = z.infer<
  typeof RequisiteProviderBranchInputSchema
>;

export const CreateRequisiteProviderInputSchema = providerFieldsSchema.extend({
  identifiers: z.array(RequisiteProviderIdentifierInputSchema).default([]),
  branches: z.array(RequisiteProviderBranchInputSchema).default([]),
});
export type CreateRequisiteProviderInput = z.input<
  typeof CreateRequisiteProviderInputSchema
>;

export const UpdateRequisiteProviderInputSchema = z.object({
  kind: RequisiteKindSchema.exactOptional(),
  legalName: z.string().trim().min(1).max(255).exactOptional(),
  displayName: z.string().trim().min(1).max(255).exactOptional(),
  description: nullableTextPatch,
  country: nullableCountryPatch,
  jurisdictionCode: nullableShortTextPatch,
  website: nullableTextPatch,
  identifiers: z.array(RequisiteProviderIdentifierInputSchema).exactOptional(),
  branches: z.array(RequisiteProviderBranchInputSchema).exactOptional(),
});
export type UpdateRequisiteProviderInput = z.input<
  typeof UpdateRequisiteProviderInputSchema
>;
