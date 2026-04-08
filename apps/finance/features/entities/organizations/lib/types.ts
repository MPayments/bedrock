import type { ListResult } from "@/features/entities/shared/lib/list-result";

type LocaleTextMap = Record<string, string | null> | null;

export type SerializedOrganizationLegalEntity = {
  profile: {
    id: string;
    organizationId: string | null;
    counterpartyId: string | null;
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
    createdAt: string | Date;
    updatedAt: string | Date;
  };
  identifiers: Array<{
    id: string;
    partyLegalProfileId: string;
    scheme: string;
    value: string;
    normalizedValue: string;
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
  address: {
    id: string;
    partyLegalProfileId: string;
    countryCode: string | null;
    postalCode: string | null;
    city: string | null;
    streetAddress: string | null;
    addressDetails: string | null;
    fullAddress: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  } | null;
  contacts: Array<{
    id: string;
    partyLegalProfileId: string;
    type: string;
    label: string | null;
    value: string;
    isPrimary: boolean;
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
  representatives: Array<{
    id: string;
    partyLegalProfileId: string;
    role: string;
    fullName: string;
    fullNameI18n: LocaleTextMap;
    title: string | null;
    titleI18n: LocaleTextMap;
    basisDocument: string | null;
    basisDocumentI18n: LocaleTextMap;
    isPrimary: boolean;
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
  licenses: Array<{
    id: string;
    partyLegalProfileId: string;
    licenseType: string;
    licenseNumber: string;
    issuedBy: string | null;
    issuedAt: string | Date | null;
    expiresAt: string | Date | null;
    activityCode: string | null;
    activityText: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  }>;
};

export type SerializedOrganization = {
  id: string;
  externalId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: string | null;
  kind: "legal_entity" | "individual";
  partyProfile: SerializedOrganizationLegalEntity | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationsListResult = ListResult<SerializedOrganization>;
