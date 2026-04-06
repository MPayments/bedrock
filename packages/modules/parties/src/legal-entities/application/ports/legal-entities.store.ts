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
  replaceAddresses(
    input: LegalEntityOwnerRef & { items: PartyAddressInput[] },
  ): Promise<PartyAddress[]>;
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
