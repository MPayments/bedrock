import type {
  PartyAddress,
  PartyContact,
  PartyProfileBundle,
  PartyIdentifier,
  PartyProfileOwnerType,
  PartyProfile,
  PartyLicense,
  PartyRepresentative,
} from "../contracts";

export interface PartyProfileOwnerRef {
  ownerType: PartyProfileOwnerType;
  ownerId: string;
}

export interface PartyProfilesReads {
  findBundleByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyProfileBundle | null>;
  findProfileByOwner(input: PartyProfileOwnerRef): Promise<PartyProfile | null>;
  listIdentifiersByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyIdentifier[]>;
  findAddressByOwner(input: PartyProfileOwnerRef): Promise<PartyAddress | null>;
  listContactsByOwner(input: PartyProfileOwnerRef): Promise<PartyContact[]>;
  listRepresentativesByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyRepresentative[]>;
  listLicensesByOwner(input: PartyProfileOwnerRef): Promise<PartyLicense[]>;
}
