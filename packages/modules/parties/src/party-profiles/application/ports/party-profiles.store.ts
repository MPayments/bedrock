import type {
  PartyAddress,
  PartyAddressInput,
  PartyContact,
  PartyContactInput,
  PartyProfileBundle,
  PartyIdentifier,
  PartyIdentifierInput,
  PartyProfileOwnerType,
  PartyProfile,
  PartyProfileInput,
  PartyLicense,
  PartyLicenseInput,
  PartyRepresentative,
  PartyRepresentativeInput,
} from "../contracts";

export interface PartyProfileOwnerRef {
  ownerType: PartyProfileOwnerType;
  ownerId: string;
}

export interface PartyProfilesStore {
  findBundleByOwner(input: PartyProfileOwnerRef): Promise<PartyProfileBundle | null>;
  upsertProfile(
    input: PartyProfileOwnerRef & { profile: PartyProfileInput },
  ): Promise<PartyProfile>;
  replaceIdentifiers(
    input: PartyProfileOwnerRef & { items: PartyIdentifierInput[] },
  ): Promise<PartyIdentifier[]>;
  replaceAddress(
    input: PartyProfileOwnerRef & { item: PartyAddressInput | null },
  ): Promise<PartyAddress | null>;
  replaceContacts(
    input: PartyProfileOwnerRef & { items: PartyContactInput[] },
  ): Promise<PartyContact[]>;
  replaceRepresentatives(
    input: PartyProfileOwnerRef & { items: PartyRepresentativeInput[] },
  ): Promise<PartyRepresentative[]>;
  replaceLicenses(
    input: PartyProfileOwnerRef & { items: PartyLicenseInput[] },
  ): Promise<PartyLicense[]>;
}
