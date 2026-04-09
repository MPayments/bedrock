import type {
  PartyAddressInput,
  PartyContactInput,
  PartyProfileBundleInput,
  PartyIdentifierInput,
  PartyLicenseInput,
  PartyRepresentativeInput,
} from "./contracts";

type LocaleTextMap = Record<string, string | null> | null;

export type PartyProfileBundleSource = {
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
    businessActivityTextI18n: LocaleTextMap;
  };
  identifiers: Array<{
    id?: string;
    scheme: PartyIdentifierInput["scheme"];
    value: string;
  }>;
  address: {
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
    issuedByI18n: LocaleTextMap;
    issuedAt: Date | string | null;
    expiresAt: Date | string | null;
    activityCode: string | null;
    activityText: string | null;
    activityTextI18n: LocaleTextMap;
  }>;
};

type PartyProfileBundleLike = PartyProfileBundleSource | null | undefined;

export type PartyProfileSeed = {
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
  items: PartyProfileBundleSource["identifiers"],
): PartyIdentifierInput[] {
  return items.map((item) => ({
    id: item.id,
    scheme: item.scheme,
    value: item.value,
  }));
}

function cloneAddress(
  item: PartyProfileBundleSource["address"],
): PartyAddressInput | null {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    countryCode: item.countryCode ?? null,
    postalCode: item.postalCode ?? null,
    city: item.city ?? null,
    cityI18n: cloneLocaleTextMap(item.cityI18n ?? null),
    streetAddress: item.streetAddress ?? null,
    streetAddressI18n: cloneLocaleTextMap(item.streetAddressI18n ?? null),
    addressDetails: item.addressDetails ?? null,
    addressDetailsI18n: cloneLocaleTextMap(item.addressDetailsI18n ?? null),
    fullAddress: item.fullAddress ?? null,
    fullAddressI18n: cloneLocaleTextMap(item.fullAddressI18n ?? null),
  };
}

function cloneContacts(
  items: PartyProfileBundleSource["contacts"],
): PartyContactInput[] {
  return items.map((item) => ({
    id: item.id,
    type: item.type,
    value: item.value,
    isPrimary: item.isPrimary,
  }));
}

function cloneRepresentatives(
  items: PartyProfileBundleSource["representatives"],
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
  items: PartyProfileBundleSource["licenses"],
): PartyLicenseInput[] {
  return items.map((item) => ({
    id: item.id,
    licenseType: item.licenseType,
    licenseNumber: item.licenseNumber,
    issuedBy: item.issuedBy ?? null,
    issuedByI18n: cloneLocaleTextMap(item.issuedByI18n ?? null),
    issuedAt: normalizeDate(item.issuedAt ?? null),
    expiresAt: normalizeDate(item.expiresAt ?? null),
    activityCode: item.activityCode ?? null,
    activityText: item.activityText ?? null,
    activityTextI18n: cloneLocaleTextMap(item.activityTextI18n ?? null),
  }));
}

export function createSeededPartyProfileBundle(
  seed: PartyProfileSeed,
): PartyProfileBundleInput {
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
      businessActivityTextI18n: null,
    },
    identifiers: [],
    address: null,
    contacts: [],
    representatives: [],
    licenses: [],
  };
}

export function toPartyProfileBundleInput(
  bundle: PartyProfileBundleLike,
  seed?: PartyProfileSeed,
): PartyProfileBundleInput {
  const source = bundle ?? (seed ? createSeededPartyProfileBundle(seed) : null);

  if (!source) {
    return createSeededPartyProfileBundle({
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
      businessActivityTextI18n: cloneLocaleTextMap(
        source.profile.businessActivityTextI18n ?? null,
      ),
    },
    identifiers: cloneIdentifiers(source.identifiers),
    address: cloneAddress(source.address),
    contacts: cloneContacts(source.contacts),
    representatives: cloneRepresentatives(source.representatives),
    licenses: cloneLicenses(source.licenses),
  };
}

export function clonePartyProfileBundleInput(
  bundle: PartyProfileBundleInput,
): PartyProfileBundleInput {
  return toPartyProfileBundleInput(bundle);
}
