import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { CountryCodeSchema } from "../../shared/domain/party-kind";
import {
  LocaleTextMapSchema,
  type LocaleTextMap,
} from "../../shared/domain/locale-map";

const nullableText = z
  .string()
  .trim()
  .nullish()
  .transform((value) => trimToNull(value) ?? null);

const nullableDate = z.coerce.date().nullish().transform((value) => value ?? null);

export const PartyLegalOwnerTypeSchema = z.enum([
  "organization",
  "counterparty",
]);

export type PartyLegalOwnerType = z.infer<typeof PartyLegalOwnerTypeSchema>;

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
  jurisdictionCode: z.string().nullable(),
  registrationAuthority: z.string().nullable(),
  registeredAt: z.date().nullable(),
  businessActivityCode: z.string().nullable(),
  businessActivityText: z.string().nullable(),
  status: z.string().nullable(),
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
  jurisdictionCode: nullableText,
  registrationAuthority: nullableText,
  registeredAt: nullableDate,
  businessActivityCode: nullableText,
  businessActivityText: nullableText,
  status: nullableText,
});

export type PartyLegalProfileInput = z.infer<
  typeof PartyLegalProfileInputSchema
>;

export const PartyLegalIdentifierSchema = z.object({
  id: z.uuid(),
  partyLegalProfileId: z.uuid(),
  scheme: z.string(),
  value: z.string(),
  normalizedValue: z.string(),
  jurisdictionCode: z.string().nullable(),
  issuer: z.string().nullable(),
  isPrimary: z.boolean(),
  validFrom: z.date().nullable(),
  validTo: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyLegalIdentifier = z.infer<typeof PartyLegalIdentifierSchema>;

export const PartyLegalIdentifierInputSchema = z.object({
  id: z.uuid().optional(),
  scheme: z.string().trim().min(1),
  value: z.string().trim().min(1),
  jurisdictionCode: nullableText,
  issuer: nullableText,
  isPrimary: z.boolean().default(false),
  validFrom: nullableDate,
  validTo: nullableDate,
});

export type PartyLegalIdentifierInput = z.infer<
  typeof PartyLegalIdentifierInputSchema
>;

export const PartyAddressSchema = z.object({
  id: z.uuid(),
  partyLegalProfileId: z.uuid(),
  type: z.string(),
  label: z.string().nullable(),
  countryCode: CountryCodeSchema.nullable(),
  jurisdictionCode: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  line1: z.string().nullable(),
  line2: z.string().nullable(),
  rawText: z.string().nullable(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyAddress = z.infer<typeof PartyAddressSchema>;

export const PartyAddressInputSchema = z.object({
  id: z.uuid().optional(),
  type: z.string().trim().min(1),
  label: nullableText,
  countryCode: CountryCodeSchema.nullish().transform((value) => value ?? null),
  jurisdictionCode: nullableText,
  postalCode: nullableText,
  city: nullableText,
  line1: nullableText,
  line2: nullableText,
  rawText: nullableText,
  isPrimary: z.boolean().default(false),
});

export type PartyAddressInput = z.infer<typeof PartyAddressInputSchema>;

export const PartyContactSchema = z.object({
  id: z.uuid(),
  partyLegalProfileId: z.uuid(),
  type: z.string(),
  label: z.string().nullable(),
  value: z.string(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PartyContact = z.infer<typeof PartyContactSchema>;

export const PartyContactInputSchema = z.object({
  id: z.uuid().optional(),
  type: z.string().trim().min(1),
  label: nullableText,
  value: z.string().trim().min(1),
  isPrimary: z.boolean().default(false),
});

export type PartyContactInput = z.infer<typeof PartyContactInputSchema>;

export const PartyRepresentativeSchema = z.object({
  id: z.uuid(),
  partyLegalProfileId: z.uuid(),
  role: z.string(),
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
  role: z.string().trim().min(1),
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
  licenseType: z.string(),
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
  licenseType: z.string().trim().min(1),
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
  addresses: z.array(PartyAddressSchema),
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
  addresses: z.array(PartyAddressInputSchema).default([]),
  contacts: z.array(PartyContactInputSchema).default([]),
  representatives: z.array(PartyRepresentativeInputSchema).default([]),
  licenses: z.array(PartyLicenseInputSchema).default([]),
});

export type PartyLegalEntityBundleInput = z.infer<
  typeof PartyLegalEntityBundleInputSchema
>;

export type PartyLegalLocaleTextMap = LocaleTextMap;

