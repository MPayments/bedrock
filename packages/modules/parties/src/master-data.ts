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

  return bundle.identifiers.find((identifier) => identifier.scheme === scheme) ?? null;
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
): PartyAddress | null {
  const bundle = getBundle(partyOrBundle);
  if (!bundle) {
    return null;
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
