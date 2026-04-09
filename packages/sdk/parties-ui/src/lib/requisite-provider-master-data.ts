import type {
  RequisiteProviderBranchIdentifierInput,
  RequisiteProviderBranchInput,
  RequisiteProviderIdentifierInput,
} from "./contracts";

import type { LocaleTextMap } from "./localized-text";

export type CompactProviderFormValues = {
  address: string;
  bic: string;
  contact: string;
  country: string;
  description: string;
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  legalName: string;
  swift: string;
};

export type RequisiteProviderMasterDataSource = {
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  legalName: string;
  legalNameI18n: LocaleTextMap;
  displayName: string;
  displayNameI18n: LocaleTextMap;
  description: string | null;
  country: string | null;
  website: string | null;
  identifiers: Array<{
    id?: string;
    scheme: RequisiteProviderIdentifierInput["scheme"];
    value: string;
    isPrimary: boolean;
  }>;
  branches: Array<{
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
    identifiers: Array<{
      id?: string;
      scheme: RequisiteProviderBranchIdentifierInput["scheme"];
      value: string;
      isPrimary: boolean;
    }>;
  }>;
};

export type RequisiteProviderMasterDataInput = {
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  legalName: string;
  legalNameI18n: LocaleTextMap;
  displayName: string;
  displayNameI18n: LocaleTextMap;
  description: string | null;
  country: string | null;
  website: string | null;
  identifiers: RequisiteProviderIdentifierInput[];
  branches: RequisiteProviderBranchInput[];
};

export function createEmptyRequisiteProviderMasterDataSource(): RequisiteProviderMasterDataSource {
  return {
    kind: "bank",
    legalName: "",
    legalNameI18n: null,
    displayName: "",
    displayNameI18n: null,
    description: null,
    country: null,
    website: null,
    identifiers: [],
    branches: [],
  };
}

function trimToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildCompactProviderIdentifiers(
  values: Pick<CompactProviderFormValues, "bic" | "swift">,
): RequisiteProviderIdentifierInput[] {
  return [
    values.bic.trim()
      ? {
          scheme: "bic",
          value: values.bic.trim(),
          isPrimary: true,
        }
      : null,
    values.swift.trim()
      ? {
          scheme: "swift",
          value: values.swift.trim(),
          isPrimary: true,
        }
      : null,
  ].filter(
    (
      item,
    ): item is RequisiteProviderIdentifierInput => item !== null,
  );
}

export function buildCompactProviderBranches(
  values: Pick<CompactProviderFormValues, "address" | "contact" | "country" | "legalName">,
  current?: Pick<RequisiteProviderMasterDataSource, "branches"> | null,
): RequisiteProviderBranchInput[] {
  const address = values.address.trim();
  const contact = values.contact.trim();
  const currentPrimaryBranch =
    current?.branches.find((branch) => branch.isPrimary) ?? current?.branches[0] ?? null;

  if (!address && !contact && !currentPrimaryBranch) {
    return [];
  }

  const contactEmail = contact.includes("@") ? contact : null;
  const contactPhone = contact && !contact.includes("@") ? contact : null;

  return [
    {
      id: currentPrimaryBranch?.id,
      code: currentPrimaryBranch?.code ?? null,
      name: currentPrimaryBranch?.name ?? values.legalName.trim(),
      nameI18n: currentPrimaryBranch?.nameI18n ?? null,
      country: trimToNull(values.country),
      postalCode: currentPrimaryBranch?.postalCode ?? null,
      city: currentPrimaryBranch?.city ?? null,
      cityI18n: currentPrimaryBranch?.cityI18n ?? null,
      line1: currentPrimaryBranch?.line1 ?? null,
      line1I18n: currentPrimaryBranch?.line1I18n ?? null,
      line2: currentPrimaryBranch?.line2 ?? null,
      line2I18n: currentPrimaryBranch?.line2I18n ?? null,
      rawAddress: address || currentPrimaryBranch?.rawAddress || null,
      rawAddressI18n: currentPrimaryBranch?.rawAddressI18n ?? null,
      contactEmail: contactEmail ?? currentPrimaryBranch?.contactEmail ?? null,
      contactPhone: contactPhone ?? currentPrimaryBranch?.contactPhone ?? null,
      isPrimary: true,
      identifiers:
        currentPrimaryBranch?.identifiers.map((identifier) => ({
          id: identifier.id,
          scheme: identifier.scheme,
          value: identifier.value,
          isPrimary: identifier.isPrimary,
        })) ?? [],
    },
  ];
}

export function createCompactProviderInput(
  values: CompactProviderFormValues,
  current?: RequisiteProviderMasterDataSource | null,
): RequisiteProviderMasterDataInput {
  return {
    kind: values.kind,
    legalName: values.legalName.trim(),
    legalNameI18n: current?.legalNameI18n ?? null,
    displayName: values.legalName.trim(),
    displayNameI18n: current?.displayNameI18n ?? null,
    description: trimToNull(values.description),
    country: trimToNull(values.country)?.toUpperCase() ?? null,
    website: current?.website ?? null,
    identifiers: buildCompactProviderIdentifiers(values),
    branches: buildCompactProviderBranches(values, current),
  };
}

export function toRequisiteProviderMasterDataInput(
  provider: RequisiteProviderMasterDataSource,
): RequisiteProviderMasterDataInput {
  return {
    kind: provider.kind,
    legalName: provider.legalName,
    legalNameI18n: provider.legalNameI18n ?? null,
    displayName: provider.displayName,
    displayNameI18n: provider.displayNameI18n ?? null,
    description: provider.description ?? null,
    country: provider.country ?? null,
    website: provider.website ?? null,
    identifiers: provider.identifiers.map((identifier) => ({
      id: identifier.id,
      scheme: identifier.scheme,
      value: identifier.value,
      isPrimary: identifier.isPrimary,
    })),
    branches: provider.branches.map((branch) => ({
      id: branch.id,
      code: branch.code ?? null,
      name: branch.name,
      nameI18n: branch.nameI18n ?? null,
      country: branch.country ?? null,
      postalCode: branch.postalCode ?? null,
      city: branch.city ?? null,
      cityI18n: branch.cityI18n ?? null,
      line1: branch.line1 ?? null,
      line1I18n: branch.line1I18n ?? null,
      line2: branch.line2 ?? null,
      line2I18n: branch.line2I18n ?? null,
      rawAddress: branch.rawAddress ?? null,
      rawAddressI18n: branch.rawAddressI18n ?? null,
      contactEmail: branch.contactEmail ?? null,
      contactPhone: branch.contactPhone ?? null,
      isPrimary: branch.isPrimary,
      identifiers: branch.identifiers.map((identifier) => ({
        id: identifier.id,
        scheme: identifier.scheme,
        value: identifier.value,
        isPrimary: identifier.isPrimary,
      })),
    })),
  };
}

export function cloneRequisiteProviderMasterDataInput(
  input: RequisiteProviderMasterDataInput,
): RequisiteProviderMasterDataInput {
  return {
    kind: input.kind,
    legalName: input.legalName,
    legalNameI18n: input.legalNameI18n ?? null,
    displayName: input.displayName,
    displayNameI18n: input.displayNameI18n ?? null,
    description: input.description ?? null,
    country: input.country ?? null,
    website: input.website ?? null,
    identifiers: input.identifiers.map((identifier) => ({
      id: identifier.id,
      scheme: identifier.scheme,
      value: identifier.value,
      isPrimary: identifier.isPrimary,
    })),
    branches: input.branches.map((branch) => ({
      id: branch.id,
      code: branch.code ?? null,
      name: branch.name,
      nameI18n: branch.nameI18n ?? null,
      country: branch.country ?? null,
      postalCode: branch.postalCode ?? null,
      city: branch.city ?? null,
      cityI18n: branch.cityI18n ?? null,
      line1: branch.line1 ?? null,
      line1I18n: branch.line1I18n ?? null,
      line2: branch.line2 ?? null,
      line2I18n: branch.line2I18n ?? null,
      rawAddress: branch.rawAddress ?? null,
      rawAddressI18n: branch.rawAddressI18n ?? null,
      contactEmail: branch.contactEmail ?? null,
      contactPhone: branch.contactPhone ?? null,
      isPrimary: branch.isPrimary,
      identifiers: branch.identifiers.map((identifier) => ({
        id: identifier.id,
        scheme: identifier.scheme,
        value: identifier.value,
        isPrimary: identifier.isPrimary,
      })),
    })),
  };
}
