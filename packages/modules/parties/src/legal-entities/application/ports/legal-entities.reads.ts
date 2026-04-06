import type {
  PartyAddress,
  PartyContact,
  PartyLegalEntityBundle,
  PartyLegalIdentifier,
  PartyLegalOwnerType,
  PartyLegalProfile,
  PartyLicense,
  PartyRepresentative,
} from "../contracts";

export interface LegalEntityOwnerRef {
  ownerType: PartyLegalOwnerType;
  ownerId: string;
}

export interface LegalEntitiesReads {
  findBundleByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLegalEntityBundle | null>;
  findProfileByOwner(input: LegalEntityOwnerRef): Promise<PartyLegalProfile | null>;
  listIdentifiersByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLegalIdentifier[]>;
  listAddressesByOwner(input: LegalEntityOwnerRef): Promise<PartyAddress[]>;
  listContactsByOwner(input: LegalEntityOwnerRef): Promise<PartyContact[]>;
  listRepresentativesByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyRepresentative[]>;
  listLicensesByOwner(input: LegalEntityOwnerRef): Promise<PartyLicense[]>;
}

