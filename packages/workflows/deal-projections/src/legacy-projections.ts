import {
  findPartyAddress,
  findPartyContact,
  findPartyLegalIdentifier,
  findPartyRepresentative,
  formatPartyAddress,
} from "@bedrock/parties";
import type { Counterparty } from "@bedrock/parties/contracts";
import type { PartyLegalLocaleTextMap } from "@bedrock/parties/contracts";

type PartyWithLegalEntity = Pick<Counterparty, "legalEntity">;

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
