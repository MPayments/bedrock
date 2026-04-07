import type {
  RequisiteProviderBranchInput,
  RequisiteProviderIdentifierInput,
} from "@bedrock/parties/contracts";

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
  displayName: string;
  description: string | null;
  country: string | null;
  website: string | null;
  identifiers: Array<{
    id?: string;
    scheme: string;
    value: string;
    isPrimary: boolean;
  }>;
  branches: Array<{
    id?: string;
    code: string | null;
    name: string;
    country: string | null;
    postalCode: string | null;
    city: string | null;
    line1: string | null;
    line2: string | null;
    rawAddress: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    isPrimary: boolean;
    identifiers: Array<{
      id?: string;
      scheme: string;
      value: string;
      isPrimary: boolean;
    }>;
  }>;
};

export type RequisiteProviderMasterDataInput = {
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  legalName: string;
  displayName: string;
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
    displayName: "",
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
      country: trimToNull(values.country),
      postalCode: currentPrimaryBranch?.postalCode ?? null,
      city: currentPrimaryBranch?.city ?? null,
      line1: currentPrimaryBranch?.line1 ?? null,
      line2: currentPrimaryBranch?.line2 ?? null,
      rawAddress: address || currentPrimaryBranch?.rawAddress || null,
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
    displayName: values.legalName.trim(),
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
    displayName: provider.displayName,
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
      country: branch.country ?? null,
      postalCode: branch.postalCode ?? null,
      city: branch.city ?? null,
      line1: branch.line1 ?? null,
      line2: branch.line2 ?? null,
      rawAddress: branch.rawAddress ?? null,
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
    displayName: input.displayName,
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
      country: branch.country ?? null,
      postalCode: branch.postalCode ?? null,
      city: branch.city ?? null,
      line1: branch.line1 ?? null,
      line2: branch.line2 ?? null,
      rawAddress: branch.rawAddress ?? null,
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
