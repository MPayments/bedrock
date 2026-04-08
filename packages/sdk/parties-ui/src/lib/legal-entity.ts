import type {
  PartyAddressInput,
  PartyContactInput,
  PartyLegalEntityBundleInput,
  PartyLegalIdentifierInput,
  PartyLicenseInput,
  PartyRepresentativeInput,
} from "@bedrock/parties/contracts";

type LocaleTextMap = Record<string, string | null> | null;

export type PartyLegalEntityBundleSource = {
  profile: {
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
  };
  identifiers: Array<{
    id?: string;
    scheme: PartyLegalIdentifierInput["scheme"];
    value: string;
  }>;
  address: {
    id?: string;
    countryCode: string | null;
    postalCode: string | null;
    city: string | null;
    streetAddress: string | null;
    addressDetails: string | null;
    fullAddress: string | null;
  } | null;
  contacts: Array<{
    id?: string;
    type: PartyContactInput["type"];
    value: string;
    isPrimary: boolean;
  }>;
  representatives: Array<{
    id?: string;
    role: PartyRepresentativeInput["role"];
    fullName: string;
    fullNameI18n: LocaleTextMap;
    title: string | null;
    titleI18n: LocaleTextMap;
    basisDocument: string | null;
    basisDocumentI18n: LocaleTextMap;
    isPrimary: boolean;
  }>;
  licenses: Array<{
    id?: string;
    licenseType: PartyLicenseInput["licenseType"];
    licenseNumber: string;
    issuedBy: string | null;
    issuedAt: Date | string | null;
    expiresAt: Date | string | null;
    activityCode: string | null;
    activityText: string | null;
  }>;
};

type LegalEntityBundleLike = PartyLegalEntityBundleSource | null | undefined;

export type PartyLegalEntitySeed = {
  countryCode?: string | null;
  fullName: string;
  shortName: string;
};

function cloneLocaleTextMap(value: LocaleTextMap): LocaleTextMap {
  if (!value) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).map(([locale, text]) => [locale, text ?? null]),
  );
}

function cloneDate(value: Date | null): Date | null {
  return value ? new Date(value) : null;
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? cloneDate(value) : new Date(value);
}

function cloneIdentifiers(
  items: PartyLegalEntityBundleSource["identifiers"],
): PartyLegalIdentifierInput[] {
  return items.map((item) => ({
    id: item.id,
    scheme: item.scheme,
    value: item.value,
  }));
}

function cloneAddress(
  item: PartyLegalEntityBundleSource["address"],
): PartyAddressInput | null {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    countryCode: item.countryCode ?? null,
    postalCode: item.postalCode ?? null,
    city: item.city ?? null,
    streetAddress: item.streetAddress ?? null,
    addressDetails: item.addressDetails ?? null,
    fullAddress: item.fullAddress ?? null,
  };
}

function cloneContacts(
  items: PartyLegalEntityBundleSource["contacts"],
): PartyContactInput[] {
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    value: item.value,
    isPrimary: item.isPrimary,
  }));
}

function cloneRepresentatives(
  items: PartyLegalEntityBundleSource["representatives"],
): PartyRepresentativeInput[] {
  return items.map((item) => ({
    id: item.id,
    role: item.role,
    fullName: item.fullName,
    fullNameI18n: cloneLocaleTextMap(item.fullNameI18n ?? null),
    title: item.title ?? null,
    titleI18n: cloneLocaleTextMap(item.titleI18n ?? null),
    basisDocument: item.basisDocument ?? null,
    basisDocumentI18n: cloneLocaleTextMap(item.basisDocumentI18n ?? null),
    isPrimary: item.isPrimary,
  }));
}

function cloneLicenses(
  items: PartyLegalEntityBundleSource["licenses"],
): PartyLicenseInput[] {
  return items.map((item) => ({
    id: item.id,
    licenseType: item.licenseType,
    licenseNumber: item.licenseNumber,
    issuedBy: item.issuedBy ?? null,
    issuedAt: normalizeDate(item.issuedAt ?? null),
    expiresAt: normalizeDate(item.expiresAt ?? null),
    activityCode: item.activityCode ?? null,
    activityText: item.activityText ?? null,
  }));
}

export function createSeededLegalEntityBundle(
  seed: PartyLegalEntitySeed,
): PartyLegalEntityBundleInput {
  return {
    profile: {
      fullName: seed.fullName,
      shortName: seed.shortName,
      fullNameI18n: null,
      shortNameI18n: null,
      legalFormCode: null,
      legalFormLabel: null,
      legalFormLabelI18n: null,
      countryCode: seed.countryCode ?? null,
      businessActivityCode: null,
      businessActivityText: null,
    },
    identifiers: [],
    address: null,
    contacts: [],
    representatives: [],
    licenses: [],
  };
}

export function toLegalEntityBundleInput(
  bundle: LegalEntityBundleLike,
  seed?: PartyLegalEntitySeed,
): PartyLegalEntityBundleInput {
  const source = bundle ?? (seed ? createSeededLegalEntityBundle(seed) : null);

  if (!source) {
    return createSeededLegalEntityBundle({
      fullName: "",
      shortName: "",
      countryCode: null,
    });
  }

  return {
    profile: {
      fullName: source.profile.fullName,
      shortName: source.profile.shortName,
      fullNameI18n: cloneLocaleTextMap(source.profile.fullNameI18n ?? null),
      shortNameI18n: cloneLocaleTextMap(source.profile.shortNameI18n ?? null),
      legalFormCode: source.profile.legalFormCode ?? null,
      legalFormLabel: source.profile.legalFormLabel ?? null,
      legalFormLabelI18n: cloneLocaleTextMap(
        source.profile.legalFormLabelI18n ?? null,
      ),
      countryCode: source.profile.countryCode ?? null,
      businessActivityCode: source.profile.businessActivityCode ?? null,
      businessActivityText: source.profile.businessActivityText ?? null,
    },
    identifiers: cloneIdentifiers(source.identifiers),
    address: cloneAddress(source.address),
    contacts: cloneContacts(source.contacts),
    representatives: cloneRepresentatives(source.representatives),
    licenses: cloneLicenses(source.licenses),
  };
}

export function cloneLegalEntityBundleInput(
  bundle: PartyLegalEntityBundleInput,
): PartyLegalEntityBundleInput {
  return toLegalEntityBundleInput(bundle);
}
