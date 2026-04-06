import {
  findPartyAddress,
  findPartyContact,
  findPartyLegalIdentifier,
  findPartyRepresentative,
  findRequisiteIdentifier,
  findRequisiteProviderIdentifier,
  formatPartyAddress,
  formatRequisiteProviderAddress,
  resolveRequisiteProviderDisplayName,
} from "@bedrock/parties";
import type {
  Counterparty,
  Organization,
  Requisite,
  RequisiteProvider,
} from "@bedrock/parties/contracts";
import type { PartyLegalLocaleTextMap } from "@bedrock/parties/contracts";

type PartyWithLegalEntity = Pick<Counterparty | Organization, "legalEntity">;

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
