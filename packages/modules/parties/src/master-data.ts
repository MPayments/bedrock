import type {
  Counterparty,
  Organization,
  Requisite,
  RequisiteProvider,
} from "./contracts";
import type {
  PartyAddress,
  PartyContact,
  PartyLegalEntityBundle,
  PartyLegalIdentifier,
  PartyRepresentative,
  PartyLegalLocaleTextMap,
} from "./legal-entities/application/contracts";

type PartyWithLegalEntity = Pick<
  Counterparty | Organization,
  "legalEntity"
>;

function pickPrimary<T extends { isPrimary: boolean }>(items: T[]): T | null {
  return items.find((item) => item.isPrimary) ?? items[0] ?? null;
}

function getBundle(
  partyOrBundle: PartyWithLegalEntity | PartyLegalEntityBundle | null,
) {
  if (!partyOrBundle) {
    return null;
  }

  return "profile" in partyOrBundle ? partyOrBundle : partyOrBundle.legalEntity;
}

export function findPartyLegalIdentifier(
  partyOrBundle: PartyWithLegalEntity | PartyLegalEntityBundle | null,
  scheme: string,
): PartyLegalIdentifier | null {
  const bundle = getBundle(partyOrBundle);
  if (!bundle) {
    return null;
  }

  return (
    bundle.identifiers.find(
      (identifier) => identifier.scheme === scheme && identifier.isPrimary,
    ) ??
    bundle.identifiers.find((identifier) => identifier.scheme === scheme) ??
    null
  );
}

export function findPartyContact(
  partyOrBundle: PartyWithLegalEntity | PartyLegalEntityBundle | null,
  type: string,
): PartyContact | null {
  const bundle = getBundle(partyOrBundle);
  if (!bundle) {
    return null;
  }

  return pickPrimary(bundle.contacts.filter((contact) => contact.type === type));
}

export function findPartyAddress(
  partyOrBundle: PartyWithLegalEntity | PartyLegalEntityBundle | null,
  preferredTypes: string[] = ["legal", "registered", "primary"],
): PartyAddress | null {
  const bundle = getBundle(partyOrBundle);
  if (!bundle) {
    return null;
  }

  for (const type of preferredTypes) {
    const item = pickPrimary(
      bundle.addresses.filter((address) => address.type === type),
    );
    if (item) {
      return item;
    }
  }

  return pickPrimary(bundle.addresses);
}

export function findPartyRepresentative(
  partyOrBundle: PartyWithLegalEntity | PartyLegalEntityBundle | null,
  preferredRoles: string[] = ["director", "signatory", "contact"],
): PartyRepresentative | null {
  const bundle = getBundle(partyOrBundle);
  if (!bundle) {
    return null;
  }

  for (const role of preferredRoles) {
    const item = pickPrimary(
      bundle.representatives.filter((representative) => representative.role === role),
    );
    if (item) {
      return item;
    }
  }

  return pickPrimary(bundle.representatives);
}

export function formatPartyAddress(
  address: PartyAddress | null | undefined,
): string | null {
  if (!address) {
    return null;
  }

  if (address.rawText) {
    return address.rawText;
  }

  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.postalCode,
    address.countryCode,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export function findRequisiteIdentifier(
  requisite: Requisite | null | undefined,
  scheme: string,
) {
  if (!requisite) {
    return null;
  }

  const identifiers = requisite.identifiers ?? [];

  return (
    identifiers.find(
      (identifier) => identifier.scheme === scheme && identifier.isPrimary,
    ) ??
    identifiers.find((identifier) => identifier.scheme === scheme) ??
    null
  );
}

export function findRequisiteProviderBranch(
  provider: RequisiteProvider | null | undefined,
  branchId: string | null | undefined,
) {
  if (!provider || !branchId) {
    return null;
  }

  return (provider.branches ?? []).find((branch) => branch.id === branchId) ?? null;
}

export function findRequisiteProviderIdentifier(input: {
  provider: RequisiteProvider | null | undefined;
  scheme: string;
  branchId?: string | null;
}) {
  const branch = findRequisiteProviderBranch(input.provider, input.branchId);

  if (branch) {
    const identifiers = branch.identifiers ?? [];

    return (
      identifiers.find(
        (identifier) =>
          identifier.scheme === input.scheme && identifier.isPrimary,
      ) ??
      identifiers.find((identifier) => identifier.scheme === input.scheme) ??
      null
    );
  }

  if (!input.provider) {
    return null;
  }

  const identifiers = input.provider.identifiers ?? [];

  return (
    identifiers.find(
      (identifier) =>
        identifier.scheme === input.scheme && identifier.isPrimary,
    ) ??
    identifiers.find((identifier) => identifier.scheme === input.scheme) ??
    null
  );
}

export function formatRequisiteProviderAddress(input: {
  provider: RequisiteProvider | null | undefined;
  branchId?: string | null;
}) {
  const branch = findRequisiteProviderBranch(input.provider, input.branchId);

  if (!branch) {
    return null;
  }

  if (branch.rawAddress) {
    return branch.rawAddress;
  }

  const parts = [
    branch.line1,
    branch.line2,
    branch.city,
    branch.postalCode,
    branch.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

export function resolveRequisiteProviderDisplayName(input: {
  provider: RequisiteProvider | null | undefined;
  branchId?: string | null;
}) {
  const branch = findRequisiteProviderBranch(input.provider, input.branchId);
  return branch?.name ?? input.provider?.displayName ?? null;
}

export function projectLegacyPartyLegalEntity(
  party: PartyWithLegalEntity | null | undefined,
) {
  const bundle = party?.legalEntity ?? null;
  const profile = bundle?.profile ?? null;
  const address = findPartyAddress(bundle);
  const representative = findPartyRepresentative(bundle);

  return {
    address: formatPartyAddress(address),
    addressI18n: null as PartyLegalLocaleTextMap | null,
    directorBasis: representative?.basisDocument ?? null,
    directorBasisI18n: representative?.basisDocumentI18n ?? null,
    directorName: representative?.fullName ?? null,
    directorNameI18n: representative?.fullNameI18n ?? null,
    email: findPartyContact(bundle, "email")?.value ?? null,
    inn: findPartyLegalIdentifier(bundle, "inn")?.value ?? null,
    kpp: findPartyLegalIdentifier(bundle, "kpp")?.value ?? null,
    ogrn: findPartyLegalIdentifier(bundle, "ogrn")?.value ?? null,
    okpo: findPartyLegalIdentifier(bundle, "okpo")?.value ?? null,
    oktmo: findPartyLegalIdentifier(bundle, "oktmo")?.value ?? null,
    orgNameI18n: profile?.shortNameI18n ?? null,
    orgType: profile?.legalFormLabel ?? null,
    orgTypeI18n: profile?.legalFormLabelI18n ?? null,
    phone: findPartyContact(bundle, "phone")?.value ?? null,
    position: representative?.title ?? null,
    positionI18n: representative?.titleI18n ?? null,
    taxId: findPartyLegalIdentifier(bundle, "tax_id")?.value ?? null,
  };
}

export function projectLegacyRequisiteRouting(input: {
  provider: RequisiteProvider | null | undefined;
  requisite: Requisite | null | undefined;
}) {
  return {
    accountNo:
      findRequisiteIdentifier(input.requisite, "local_account_number")?.value ??
      null,
    bankAddress: formatRequisiteProviderAddress({
      provider: input.provider,
      branchId: input.requisite?.providerBranchId ?? null,
    }),
    bankName: resolveRequisiteProviderDisplayName({
      provider: input.provider,
      branchId: input.requisite?.providerBranchId ?? null,
    }),
    bic:
      findRequisiteProviderIdentifier({
        provider: input.provider,
        branchId: input.requisite?.providerBranchId ?? null,
        scheme: "bic",
      })?.value ?? null,
    corrAccount:
      findRequisiteIdentifier(input.requisite, "corr_account")?.value ?? null,
    iban: findRequisiteIdentifier(input.requisite, "iban")?.value ?? null,
    swift:
      findRequisiteProviderIdentifier({
        provider: input.provider,
        branchId: input.requisite?.providerBranchId ?? null,
        scheme: "swift",
      })?.value ?? null,
  };
}
