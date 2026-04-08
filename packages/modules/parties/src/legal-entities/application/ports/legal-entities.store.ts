import type {
  PartyAddress,
  PartyAddressInput,
  PartyContact,
  PartyContactInput,
  PartyLegalEntityBundle,
  PartyLegalIdentifier,
  PartyLegalIdentifierInput,
  PartyLegalOwnerType,
  PartyLegalProfile,
  PartyLegalProfileInput,
  PartyLicense,
  PartyLicenseInput,
  PartyRepresentative,
  PartyRepresentativeInput,
} from "../contracts";

export interface LegalEntityOwnerRef {
  ownerType: PartyLegalOwnerType;
  ownerId: string;
}

export interface LegalEntitiesStore {
  findBundleByOwner(input: LegalEntityOwnerRef): Promise<PartyLegalEntityBundle | null>;
  upsertProfile(
    input: LegalEntityOwnerRef & { profile: PartyLegalProfileInput },
  ): Promise<PartyLegalProfile>;
  replaceIdentifiers(
    input: LegalEntityOwnerRef & { items: PartyLegalIdentifierInput[] },
  ): Promise<PartyLegalIdentifier[]>;
  replaceAddress(
    input: LegalEntityOwnerRef & { item: PartyAddressInput | null },
  ): Promise<PartyAddress | null>;
  replaceContacts(
    input: LegalEntityOwnerRef & { items: PartyContactInput[] },
  ): Promise<PartyContact[]>;
  replaceRepresentatives(
    input: LegalEntityOwnerRef & { items: PartyRepresentativeInput[] },
  ): Promise<PartyRepresentative[]>;
  replaceLicenses(
    input: LegalEntityOwnerRef & { items: PartyLicenseInput[] },
  ): Promise<PartyLicense[]>;
}
