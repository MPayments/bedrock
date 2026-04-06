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

export type LegalIdentifierScheme =
  (typeof LEGAL_IDENTIFIER_SCHEME_VALUES)[number];

export const PARTY_ADDRESS_TYPE_VALUES = [
  "legal",
  "registered",
  "mailing",
  "billing",
  "operating",
  "branch",
  "other",
] as const;

export type PartyAddressType = (typeof PARTY_ADDRESS_TYPE_VALUES)[number];

export const PARTY_CONTACT_TYPE_VALUES = [
  "email",
  "phone",
  "website",
  "fax",
  "other",
] as const;

export type PartyContactType = (typeof PARTY_CONTACT_TYPE_VALUES)[number];

export const PARTY_REPRESENTATIVE_ROLE_VALUES = [
  "director",
  "signatory",
  "contact",
  "authorized_person",
  "other",
] as const;

export type PartyRepresentativeRole =
  (typeof PARTY_REPRESENTATIVE_ROLE_VALUES)[number];

export const PARTY_LICENSE_TYPE_VALUES = [
  "company_license",
  "broker_license",
  "financial_service_license",
  "trade_license",
  "customs_license",
  "other",
] as const;

export type PartyLicenseType = (typeof PARTY_LICENSE_TYPE_VALUES)[number];

export function normalizePartyTaxonomyValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
