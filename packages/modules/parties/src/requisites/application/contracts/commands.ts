import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { LocaleTextMapSchema } from "../../../shared/domain/locale-map";
import {
  REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_VALUES,
  REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES,
} from "../../domain/identifier-schemes";
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
  legalNameI18n: LocaleTextMapSchema.optional().default(null),
  displayName: z.string().trim().min(1).max(255),
  displayNameI18n: LocaleTextMapSchema.optional().default(null),
  description: nullableText,
  country: nullableCountry,
  website: nullableText,
});
export const RequisiteProviderIdentifierSchemeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES));
export type RequisiteProviderIdentifierSchemeValue = z.infer<
  typeof RequisiteProviderIdentifierSchemeSchema
>;
export const RequisiteProviderBranchIdentifierSchemeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_VALUES));
export type RequisiteProviderBranchIdentifierSchemeValue = z.infer<
  typeof RequisiteProviderBranchIdentifierSchemeSchema
>;

export const RequisiteProviderIdentifierInputSchema = z.object({
  id: z.uuid().optional(),
  scheme: RequisiteProviderIdentifierSchemeSchema,
  value: z.string().trim().min(1),
  isPrimary: z.boolean().default(false),
});
export type RequisiteProviderIdentifierInput = z.infer<
  typeof RequisiteProviderIdentifierInputSchema
>;
export const RequisiteProviderBranchIdentifierInputSchema = z.object({
  id: z.uuid().optional(),
  scheme: RequisiteProviderBranchIdentifierSchemeSchema,
  value: z.string().trim().min(1),
  isPrimary: z.boolean().default(false),
});
export type RequisiteProviderBranchIdentifierInput = z.infer<
  typeof RequisiteProviderBranchIdentifierInputSchema
>;

export const RequisiteProviderBranchInputSchema = z.object({
  id: z.uuid().optional(),
  code: nullableShortText,
  name: z.string().trim().min(1).max(255),
  nameI18n: LocaleTextMapSchema.optional().default(null),
  country: nullableCountry,
  postalCode: nullableShortText,
  city: nullableShortText,
  cityI18n: LocaleTextMapSchema.optional().default(null),
  line1: nullableText,
  line1I18n: LocaleTextMapSchema.optional().default(null),
  line2: nullableText,
  line2I18n: LocaleTextMapSchema.optional().default(null),
  rawAddress: nullableText,
  rawAddressI18n: LocaleTextMapSchema.optional().default(null),
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
  legalNameI18n: LocaleTextMapSchema.exactOptional(),
  displayName: z.string().trim().min(1).max(255).exactOptional(),
  displayNameI18n: LocaleTextMapSchema.exactOptional(),
  description: nullableTextPatch,
  country: nullableCountryPatch,
  website: nullableTextPatch,
  identifiers: z.array(RequisiteProviderIdentifierInputSchema).exactOptional(),
  branches: z.array(RequisiteProviderBranchInputSchema).exactOptional(),
});
export type UpdateRequisiteProviderInput = z.input<
  typeof UpdateRequisiteProviderInputSchema
>;
