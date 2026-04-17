import type { LocaleTextMap } from "./localized-text";

export const LEGAL_IDENTIFIER_SCHEME_VALUES = [
  "registration_number",
  "tax_id",
  "vat_id",
  "inn",
  "kpp",
  "ogrn",
  "okpo",
  "oktmo",
  "license_number",
  "other",
] as const;

export type LegalIdentifierSchemeValue =
  (typeof LEGAL_IDENTIFIER_SCHEME_VALUES)[number];

export const PARTY_CONTACT_TYPE_VALUES = [
  "email",
  "phone",
  "website",
  "fax",
  "other",
] as const;

export type PartyContactTypeValue = (typeof PARTY_CONTACT_TYPE_VALUES)[number];

export const PARTY_REPRESENTATIVE_ROLE_VALUES = [
  "director",
  "signatory",
  "contact",
  "authorized_person",
  "other",
] as const;

export type PartyRepresentativeRoleValue =
  (typeof PARTY_REPRESENTATIVE_ROLE_VALUES)[number];

export const PARTY_LICENSE_TYPE_VALUES = [
  "company_license",
  "broker_license",
  "financial_service_license",
  "trade_license",
  "customs_license",
  "other",
] as const;

export type PartyLicenseTypeValue = (typeof PARTY_LICENSE_TYPE_VALUES)[number];

export type PartyProfileInput = {
  fullName: string;
  shortName: string;
  fullNameI18n: LocaleTextMap;
  shortNameI18n: LocaleTextMap;
  legalFormCode: string | null;
  legalFormLabel: string | null;
  legalFormLabelI18n: LocaleTextMap;
  countryCode: string | null;
  businessActivityCode: string | null;
  businessActivityText: string | null;
  businessActivityTextI18n: LocaleTextMap;
};

export type PartyIdentifierInput = {
  id?: string;
  scheme: LegalIdentifierSchemeValue;
  value: string;
};

export type PartyAddressInput = {
  id?: string;
  countryCode: string | null;
  postalCode: string | null;
  city: string | null;
  cityI18n: LocaleTextMap;
  streetAddress: string | null;
  streetAddressI18n: LocaleTextMap;
  addressDetails: string | null;
  addressDetailsI18n: LocaleTextMap;
  fullAddress: string | null;
  fullAddressI18n: LocaleTextMap;
};

export type PartyContactInput = {
  id?: string;
  type: PartyContactTypeValue;
  value: string;
  isPrimary: boolean;
};

export type PartyRepresentativeInput = {
  id?: string;
  role: PartyRepresentativeRoleValue;
  fullName: string;
  fullNameI18n: LocaleTextMap;
  title: string | null;
  titleI18n: LocaleTextMap;
  basisDocument: string | null;
  basisDocumentI18n: LocaleTextMap;
  isPrimary: boolean;
};

export type PartyLicenseInput = {
  id?: string;
  licenseType: PartyLicenseTypeValue;
  licenseNumber: string;
  issuedBy: string | null;
  issuedByI18n: LocaleTextMap;
  issuedAt: Date | null;
  expiresAt: Date | null;
  activityCode: string | null;
  activityText: string | null;
  activityTextI18n: LocaleTextMap;
};

export type PartyProfileBundleInput = {
  profile: PartyProfileInput;
  identifiers: PartyIdentifierInput[];
  address: PartyAddressInput | null;
  contacts: PartyContactInput[];
  representatives: PartyRepresentativeInput[];
  licenses: PartyLicenseInput[];
};

export const REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES = [
  "swift",
  "bic",
  "corr_account",
] as const;

export type RequisiteProviderIdentifierSchemeValue =
  (typeof REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES)[number];

export const REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_VALUES = [
  ...REQUISITE_PROVIDER_IDENTIFIER_SCHEME_VALUES,
  "branch_code",
] as const;

export type RequisiteProviderBranchIdentifierSchemeValue =
  (typeof REQUISITE_PROVIDER_BRANCH_IDENTIFIER_SCHEME_VALUES)[number];

export type RequisiteProviderIdentifierInput = {
  id?: string;
  scheme: RequisiteProviderIdentifierSchemeValue;
  value: string;
  isPrimary: boolean;
};

export type RequisiteProviderBranchIdentifierInput = {
  id?: string;
  scheme: RequisiteProviderBranchIdentifierSchemeValue;
  value: string;
  isPrimary: boolean;
};

export type RequisiteProviderBranchInput = {
  id?: string;
  code: string | null;
  name: string;
  nameI18n: LocaleTextMap;
  country: string | null;
  postalCode: string | null;
  city: string | null;
  cityI18n: LocaleTextMap;
  line1: string | null;
  line1I18n: LocaleTextMap;
  line2: string | null;
  line2I18n: LocaleTextMap;
  rawAddress: string | null;
  rawAddressI18n: LocaleTextMap;
  contactEmail: string | null;
  contactPhone: string | null;
  isPrimary: boolean;
  identifiers: RequisiteProviderBranchIdentifierInput[];
};
