type ProviderIdentifier = {
  scheme: string;
  value: string;
  isPrimary?: boolean;
};

type ProviderBranch = {
  id: string;
  name: string;
  rawAddress: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  postalCode: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isPrimary: boolean;
  identifiers: ProviderIdentifier[];
};

type ProviderShape = {
  id: string;
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  legalName: string;
  displayName: string;
  description: string | null;
  country: string | null;
  website: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  identifiers: ProviderIdentifier[];
  branches: ProviderBranch[];
};

type LegacyProviderValues = {
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  name: string;
  description: string;
  country: string;
  address: string;
  contact: string;
  bic: string;
  swift: string;
};

function pickPrimary<T extends { isPrimary?: boolean }>(items: T[]): T | null {
  return items.find((item) => item.isPrimary) ?? items[0] ?? null;
}

function findIdentifier(
  identifiers: ProviderIdentifier[],
  scheme: string,
): ProviderIdentifier | null {
  return pickPrimary(
    identifiers.filter((identifier) => identifier.scheme === scheme),
  );
}

function resolveBranchAddress(branch: ProviderBranch | null): string {
  if (!branch) {
    return "";
  }

  if (branch.rawAddress) {
    return branch.rawAddress;
  }

  return [branch.line1, branch.line2, branch.city, branch.postalCode]
    .filter((value) => value && value.trim().length > 0)
    .join(", ");
}

function resolveBranchContact(branch: ProviderBranch | null): string {
  if (!branch) {
    return "";
  }

  return [branch.contactEmail, branch.contactPhone]
    .filter((value) => value && value.trim().length > 0)
    .join(" / ");
}

export function serializeLegacyProvider(
  provider: ProviderShape,
): LegacyProviderValues & {
  id: string;
  legalName: string;
  displayName: string;
  website: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  primaryBranchId: string | null;
  primaryBranchName: string | null;
} {
  const primaryBranch = pickPrimary(provider.branches);
  const bic =
    findIdentifier(primaryBranch?.identifiers ?? [], "bic")?.value ??
    findIdentifier(provider.identifiers, "bic")?.value ??
    "";
  const swift =
    findIdentifier(primaryBranch?.identifiers ?? [], "swift")?.value ??
    findIdentifier(provider.identifiers, "swift")?.value ??
    "";

  return {
    id: provider.id,
    kind: provider.kind,
    name: provider.displayName,
    legalName: provider.legalName,
    displayName: provider.displayName,
    description: provider.description ?? "",
    country: provider.country ?? "",
    address: resolveBranchAddress(primaryBranch),
    contact: resolveBranchContact(primaryBranch),
    bic,
    swift,
    website: provider.website,
    archivedAt: provider.archivedAt,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    primaryBranchId: primaryBranch?.id ?? null,
    primaryBranchName: primaryBranch?.name ?? null,
  };
}

export function buildProviderIdentifiers(values: LegacyProviderValues) {
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
    ): item is {
      scheme: string;
      value: string;
      isPrimary: boolean;
    } => item !== null,
  );
}

export function buildPrimaryProviderBranch(
  values: LegacyProviderValues,
  current?: {
    primaryBranchId?: string | null;
    primaryBranchName?: string | null;
  },
) {
  const address = values.address.trim();
  const contact = values.contact.trim();

  if (!address && !contact && !current?.primaryBranchId) {
    return [];
  }

  const isEmail = contact.includes("@");

  return [
    {
      id: current?.primaryBranchId ?? undefined,
      name: current?.primaryBranchName ?? values.name.trim(),
      country: values.country.trim() || null,
      postalCode: null,
      city: null,
      line1: null,
      line2: null,
      rawAddress: address || null,
      contactEmail: contact ? (isEmail ? contact : null) : null,
      contactPhone: contact ? (isEmail ? null : contact) : null,
      isPrimary: true,
      identifiers: [],
    },
  ];
}
