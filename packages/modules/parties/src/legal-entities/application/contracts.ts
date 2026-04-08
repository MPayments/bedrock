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

export const PartyLegalOwnerTypeSchema = z.enum([
  "organization",
  "counterparty",
]);

export type PartyLegalOwnerType = z.infer<typeof PartyLegalOwnerTypeSchema>;

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

export const PartyLegalProfileSchema = z.object({
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
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyLegalProfile = z.infer<typeof PartyLegalProfileSchema>;

export const PartyLegalProfileInputSchema = z.object({
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
});

export type PartyLegalProfileInput = z.infer<
  typeof PartyLegalProfileInputSchema
>;

export const PartyLegalIdentifierSchema = z.object({
  id: z.uuid(),
  partyLegalProfileId: z.uuid(),
  scheme: LegalIdentifierSchemeSchema,
  value: z.string(),
  normalizedValue: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyLegalIdentifier = z.infer<typeof PartyLegalIdentifierSchema>;

export const PartyLegalIdentifierInputSchema = z.object({
  id: z.uuid().optional(),
  scheme: LegalIdentifierSchemeSchema,
  value: z.string().trim().min(1),
});

export type PartyLegalIdentifierInput = z.infer<
  typeof PartyLegalIdentifierInputSchema
>;

export const PartyAddressSchema = z.object({
  id: z.uuid(),
  partyLegalProfileId: z.uuid(),
  countryCode: CountryCodeSchema.nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  streetAddress: z.string().nullable(),
  addressDetails: z.string().nullable(),
  fullAddress: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyAddress = z.infer<typeof PartyAddressSchema>;

export const PartyAddressInputSchema = z.object({
  id: z.uuid().optional(),
  countryCode: CountryCodeSchema.nullish().transform((value) => value ?? null),
  postalCode: nullableText,
  city: nullableText,
  streetAddress: nullableText,
  addressDetails: nullableText,
  fullAddress: nullableText,
});

export type PartyAddressInput = z.infer<typeof PartyAddressInputSchema>;

export const PartyContactSchema = z.object({
  id: z.uuid(),
  partyLegalProfileId: z.uuid(),
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
  partyLegalProfileId: z.uuid(),
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
  partyLegalProfileId: z.uuid(),
  licenseType: PartyLicenseTypeSchema,
  licenseNumber: z.string(),
  issuedBy: z.string().nullable(),
  issuedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  activityCode: z.string().nullable(),
  activityText: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyLicense = z.infer<typeof PartyLicenseSchema>;

export const PartyLicenseInputSchema = z.object({
  id: z.uuid().optional(),
  licenseType: PartyLicenseTypeSchema,
  licenseNumber: z.string().trim().min(1),
  issuedBy: nullableText,
  issuedAt: nullableDate,
  expiresAt: nullableDate,
  activityCode: nullableText,
  activityText: nullableText,
});

export type PartyLicenseInput = z.infer<typeof PartyLicenseInputSchema>;

export const PartyLegalEntityBundleSchema = z.object({
  profile: PartyLegalProfileSchema,
  identifiers: z.array(PartyLegalIdentifierSchema),
  address: PartyAddressSchema.nullable(),
  contacts: z.array(PartyContactSchema),
  representatives: z.array(PartyRepresentativeSchema),
  licenses: z.array(PartyLicenseSchema),
});

export type PartyLegalEntityBundle = z.infer<
  typeof PartyLegalEntityBundleSchema
>;

export const PartyLegalEntityBundleInputSchema = z.object({
  profile: PartyLegalProfileInputSchema,
  identifiers: z.array(PartyLegalIdentifierInputSchema).default([]),
  address: PartyAddressInputSchema.nullable().default(null),
  contacts: z.array(PartyContactInputSchema).default([]),
  representatives: z.array(PartyRepresentativeInputSchema).default([]),
  licenses: z.array(PartyLicenseInputSchema).default([]),
});

export type PartyLegalEntityBundleInput = z.infer<
  typeof PartyLegalEntityBundleInputSchema
>;

export type PartyLegalLocaleTextMap = LocaleTextMap;
