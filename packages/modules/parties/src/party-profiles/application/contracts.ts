import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { CountryCodeSchema } from "../../shared/domain/party-kind";
import {
  LocaleTextMapSchema,
  type LocaleTextMap,
} from "../../shared/domain/locale-map";
import {
  LEGAL_IDENTIFIER_SCHEME_VALUES,
  PARTY_CONTACT_TYPE_VALUES,
  PARTY_LICENSE_TYPE_VALUES,
  PARTY_REPRESENTATIVE_ROLE_VALUES,
  normalizePartyTaxonomyValue,
  type LegalIdentifierScheme,
  type PartyContactType,
  type PartyLicenseType,
  type PartyRepresentativeRole,
} from "../domain/taxonomies";

const nullableText = z
  .string()
  .trim()
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

const nullableDate = z.coerce.date().nullish().transform((value) => value ?? null);

function createTaxonomySchema<const TValues extends readonly [string, ...string[]]>(
  values: TValues,
) {
  return z.preprocess(
    (value) =>
      typeof value === "string" ? normalizePartyTaxonomyValue(value) : value,
    z.enum(values),
  );
}

export const PartyProfileOwnerTypeSchema = z.enum([
  "organization",
  "counterparty",
]);

export type PartyProfileOwnerType = z.infer<typeof PartyProfileOwnerTypeSchema>;

export const LegalIdentifierSchemeSchema = createTaxonomySchema(
  LEGAL_IDENTIFIER_SCHEME_VALUES,
);
export type LegalIdentifierSchemeValue = LegalIdentifierScheme;

export const PartyContactTypeSchema = createTaxonomySchema(
  PARTY_CONTACT_TYPE_VALUES,
);
export type PartyContactTypeValue = PartyContactType;

export const PartyRepresentativeRoleSchema = createTaxonomySchema(
  PARTY_REPRESENTATIVE_ROLE_VALUES,
);
export type PartyRepresentativeRoleValue = PartyRepresentativeRole;

export const PartyLicenseTypeSchema = createTaxonomySchema(
  PARTY_LICENSE_TYPE_VALUES,
);
export type PartyLicenseTypeValue = PartyLicenseType;

export const PartyProfileSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
  fullName: z.string(),
  shortName: z.string(),
  fullNameI18n: LocaleTextMapSchema,
  shortNameI18n: LocaleTextMapSchema,
  legalFormCode: z.string().nullable(),
  legalFormLabel: z.string().nullable(),
  legalFormLabelI18n: LocaleTextMapSchema,
  countryCode: CountryCodeSchema.nullable(),
  businessActivityCode: z.string().nullable(),
  businessActivityText: z.string().nullable(),
  businessActivityTextI18n: LocaleTextMapSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyProfile = z.infer<typeof PartyProfileSchema>;

export const PartyProfileInputSchema = z.object({
  fullName: z.string().trim().min(1),
  shortName: z.string().trim().min(1),
  fullNameI18n: LocaleTextMapSchema.optional().default(null),
  shortNameI18n: LocaleTextMapSchema.optional().default(null),
  legalFormCode: nullableText,
  legalFormLabel: nullableText,
  legalFormLabelI18n: LocaleTextMapSchema.optional().default(null),
  countryCode: CountryCodeSchema.nullish().transform((value) => value ?? null),
  businessActivityCode: nullableText,
  businessActivityText: nullableText,
  businessActivityTextI18n: LocaleTextMapSchema.optional().default(null),
});

export type PartyProfileInput = z.infer<
  typeof PartyProfileInputSchema
>;

export const PartyIdentifierSchema = z.object({
  id: z.uuid(),
  partyProfileId: z.uuid(),
  scheme: LegalIdentifierSchemeSchema,
  value: z.string(),
  normalizedValue: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyIdentifier = z.infer<typeof PartyIdentifierSchema>;

export const PartyIdentifierInputSchema = z.object({
  id: z.uuid().optional(),
  scheme: LegalIdentifierSchemeSchema,
  value: z.string().trim().min(1),
});

export type PartyIdentifierInput = z.infer<
  typeof PartyIdentifierInputSchema
>;

export const PartyAddressSchema = z.object({
  id: z.uuid(),
  partyProfileId: z.uuid(),
  countryCode: CountryCodeSchema.nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  cityI18n: LocaleTextMapSchema,
  streetAddress: z.string().nullable(),
  streetAddressI18n: LocaleTextMapSchema,
  addressDetails: z.string().nullable(),
  addressDetailsI18n: LocaleTextMapSchema,
  fullAddress: z.string().nullable(),
  fullAddressI18n: LocaleTextMapSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyAddress = z.infer<typeof PartyAddressSchema>;

export const PartyAddressInputSchema = z.object({
  id: z.uuid().optional(),
  countryCode: CountryCodeSchema.nullish().transform((value) => value ?? null),
  postalCode: nullableText,
  city: nullableText,
  cityI18n: LocaleTextMapSchema.optional().default(null),
  streetAddress: nullableText,
  streetAddressI18n: LocaleTextMapSchema.optional().default(null),
  addressDetails: nullableText,
  addressDetailsI18n: LocaleTextMapSchema.optional().default(null),
  fullAddress: nullableText,
  fullAddressI18n: LocaleTextMapSchema.optional().default(null),
});

export type PartyAddressInput = z.infer<typeof PartyAddressInputSchema>;

export const PartyContactSchema = z.object({
  id: z.uuid(),
  partyProfileId: z.uuid(),
  type: PartyContactTypeSchema,
  value: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyContact = z.infer<typeof PartyContactSchema>;

export const PartyContactInputSchema = z.object({
  id: z.uuid().optional(),
  type: PartyContactTypeSchema,
  value: z.string().trim().min(1),
  isPrimary: z.boolean().default(false),
});

export type PartyContactInput = z.infer<typeof PartyContactInputSchema>;

export const PartyRepresentativeSchema = z.object({
  id: z.uuid(),
  partyProfileId: z.uuid(),
  role: PartyRepresentativeRoleSchema,
  fullName: z.string(),
  fullNameI18n: LocaleTextMapSchema,
  title: z.string().nullable(),
  titleI18n: LocaleTextMapSchema,
  basisDocument: z.string().nullable(),
  basisDocumentI18n: LocaleTextMapSchema,
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyRepresentative = z.infer<typeof PartyRepresentativeSchema>;

export const PartyRepresentativeInputSchema = z.object({
  id: z.uuid().optional(),
  role: PartyRepresentativeRoleSchema,
  fullName: z.string().trim().min(1),
  fullNameI18n: LocaleTextMapSchema.optional().default(null),
  title: nullableText,
  titleI18n: LocaleTextMapSchema.optional().default(null),
  basisDocument: nullableText,
  basisDocumentI18n: LocaleTextMapSchema.optional().default(null),
  isPrimary: z.boolean().default(false),
});

export type PartyRepresentativeInput = z.infer<
  typeof PartyRepresentativeInputSchema
>;

export const PartyLicenseSchema = z.object({
  id: z.uuid(),
  partyProfileId: z.uuid(),
  licenseType: PartyLicenseTypeSchema,
  licenseNumber: z.string(),
  issuedBy: z.string().nullable(),
  issuedByI18n: LocaleTextMapSchema,
  issuedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  activityCode: z.string().nullable(),
  activityText: z.string().nullable(),
  activityTextI18n: LocaleTextMapSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyLicense = z.infer<typeof PartyLicenseSchema>;

export const PartyLicenseInputSchema = z.object({
  id: z.uuid().optional(),
  licenseType: PartyLicenseTypeSchema,
  licenseNumber: z.string().trim().min(1),
  issuedBy: nullableText,
  issuedByI18n: LocaleTextMapSchema.optional().default(null),
  issuedAt: nullableDate,
  expiresAt: nullableDate,
  activityCode: nullableText,
  activityText: nullableText,
  activityTextI18n: LocaleTextMapSchema.optional().default(null),
});

export type PartyLicenseInput = z.infer<typeof PartyLicenseInputSchema>;

export const PartyProfileBundleSchema = z.object({
  profile: PartyProfileSchema,
  identifiers: z.array(PartyIdentifierSchema),
  address: PartyAddressSchema.nullable(),
  contacts: z.array(PartyContactSchema),
  representatives: z.array(PartyRepresentativeSchema),
  licenses: z.array(PartyLicenseSchema),
});

export type PartyProfileBundle = z.infer<
  typeof PartyProfileBundleSchema
>;

export const PartyProfileBundleInputSchema = z.object({
  profile: PartyProfileInputSchema,
  identifiers: z.array(PartyIdentifierInputSchema).default([]),
  address: PartyAddressInputSchema.nullable().default(null),
  contacts: z.array(PartyContactInputSchema).default([]),
  representatives: z.array(PartyRepresentativeInputSchema).default([]),
  licenses: z.array(PartyLicenseInputSchema).default([]),
});

export type PartyProfileBundleInput = z.infer<
  typeof PartyProfileBundleInputSchema
>;

export type PartyProfileLocaleTextMap = LocaleTextMap;
