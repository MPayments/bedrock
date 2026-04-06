import { asc, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type {
  PartyAddress,
  PartyContact,
  PartyLegalEntityBundle,
  PartyLegalIdentifier,
  PartyLegalOwnerType,
  PartyLegalProfile,
  PartyLicense,
  PartyRepresentative,
} from "../../application/contracts";
import type {
  LegalEntitiesReads,
  LegalEntityOwnerRef,
} from "../../application/ports/legal-entities.reads";
import {
  partyAddresses,
  partyContacts,
  partyLegalIdentifiers,
  partyLegalProfiles,
  partyLicenses,
  partyRepresentatives,
} from "./schema";

function profileOwnerWhere(input: {
  ownerType: PartyLegalOwnerType;
  ownerId: string;
}) {
  return input.ownerType === "organization"
    ? eq(partyLegalProfiles.organizationId, input.ownerId)
    : eq(partyLegalProfiles.counterpartyId, input.ownerId);
}

export class DrizzleLegalEntitiesReads implements LegalEntitiesReads {
  constructor(private readonly db: Queryable) {}

  async findBundleByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLegalEntityBundle | null> {
    const profile = await this.findProfileByOwner(input);

    if (!profile) {
      return null;
    }

    const [
      identifiers,
      addresses,
      contacts,
      representatives,
      licenses,
    ] = await Promise.all([
      this.listIdentifiersByOwner(input),
      this.listAddressesByOwner(input),
      this.listContactsByOwner(input),
      this.listRepresentativesByOwner(input),
      this.listLicensesByOwner(input),
    ]);

    return {
      profile,
      identifiers,
      addresses,
      contacts,
      representatives,
      licenses,
    };
  }

  async findProfileByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLegalProfile | null> {
    const [row] = await this.db
      .select()
      .from(partyLegalProfiles)
      .where(profileOwnerWhere(input))
      .limit(1);

    return (row ?? null) as PartyLegalProfile | null;
  }

  async listIdentifiersByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLegalIdentifier[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyLegalIdentifiers)
      .where(eq(partyLegalIdentifiers.partyLegalProfileId, profile.id))
      .orderBy(
        asc(partyLegalIdentifiers.scheme),
        asc(partyLegalIdentifiers.createdAt),
      );

    return rows as PartyLegalIdentifier[];
  }

  async listAddressesByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyAddress[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyAddresses)
      .where(eq(partyAddresses.partyLegalProfileId, profile.id))
      .orderBy(asc(partyAddresses.type), asc(partyAddresses.createdAt));

    return rows as PartyAddress[];
  }

  async listContactsByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyContact[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyContacts)
      .where(eq(partyContacts.partyLegalProfileId, profile.id))
      .orderBy(asc(partyContacts.type), asc(partyContacts.createdAt));

    return rows as PartyContact[];
  }

  async listRepresentativesByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyRepresentative[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyRepresentatives)
      .where(eq(partyRepresentatives.partyLegalProfileId, profile.id))
      .orderBy(
        asc(partyRepresentatives.role),
        asc(partyRepresentatives.createdAt),
      );

    return rows as PartyRepresentative[];
  }

  async listLicensesByOwner(
    input: LegalEntityOwnerRef,
  ): Promise<PartyLicense[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyLicenses)
      .where(eq(partyLicenses.partyLegalProfileId, profile.id))
      .orderBy(asc(partyLicenses.licenseType), asc(partyLicenses.createdAt));

    return rows as PartyLicense[];
  }
}
