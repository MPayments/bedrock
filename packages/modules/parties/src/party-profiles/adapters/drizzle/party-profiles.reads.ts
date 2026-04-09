import { asc, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  partyAddresses,
  partyContacts,
  partyIdentifiers,
  partyProfiles,
  partyLicenses,
  partyRepresentatives,
} from "./schema";
import type {
  PartyAddress,
  PartyContact,
  PartyProfileBundle,
  PartyIdentifier,
  PartyProfileOwnerType,
  PartyProfile,
  PartyLicense,
  PartyRepresentative,
} from "../../application/contracts";
import type {
  PartyProfilesReads,
  PartyProfileOwnerRef,
} from "../../application/ports/party-profiles.reads";

function profileOwnerWhere(input: {
  ownerType: PartyProfileOwnerType;
  ownerId: string;
}) {
  return input.ownerType === "organization"
    ? eq(partyProfiles.organizationId, input.ownerId)
    : eq(partyProfiles.counterpartyId, input.ownerId);
}

export class DrizzlePartyProfilesReads implements PartyProfilesReads {
  constructor(private readonly db: Queryable) {}

  async findBundleByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyProfileBundle | null> {
    const profile = await this.findProfileByOwner(input);

    if (!profile) {
      return null;
    }

    const [
      identifiers,
      address,
      contacts,
      representatives,
      licenses,
    ] = await Promise.all([
      this.listIdentifiersByOwner(input),
      this.findAddressByOwner(input),
      this.listContactsByOwner(input),
      this.listRepresentativesByOwner(input),
      this.listLicensesByOwner(input),
    ]);

    return {
      profile,
      identifiers,
      address,
      contacts,
      representatives,
      licenses,
    };
  }

  async findProfileByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyProfile | null> {
    const [row] = await this.db
      .select()
      .from(partyProfiles)
      .where(profileOwnerWhere(input))
      .limit(1);

    return (row ?? null) as PartyProfile | null;
  }

  async listIdentifiersByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyIdentifier[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyIdentifiers)
      .where(eq(partyIdentifiers.partyProfileId, profile.id))
      .orderBy(
        asc(partyIdentifiers.scheme),
        asc(partyIdentifiers.createdAt),
      );

    return rows as PartyIdentifier[];
  }

  async findAddressByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyAddress | null> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return null;
    }

    const [row] = await this.db
      .select()
      .from(partyAddresses)
      .where(eq(partyAddresses.partyProfileId, profile.id))
      .limit(1);

    return (row ?? null) as PartyAddress | null;
  }

  async listContactsByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyContact[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyContacts)
      .where(eq(partyContacts.partyProfileId, profile.id))
      .orderBy(asc(partyContacts.type), asc(partyContacts.createdAt));

    return rows as PartyContact[];
  }

  async listRepresentativesByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyRepresentative[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyRepresentatives)
      .where(eq(partyRepresentatives.partyProfileId, profile.id))
      .orderBy(
        asc(partyRepresentatives.role),
        asc(partyRepresentatives.createdAt),
      );

    return rows as PartyRepresentative[];
  }

  async listLicensesByOwner(
    input: PartyProfileOwnerRef,
  ): Promise<PartyLicense[]> {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(partyLicenses)
      .where(eq(partyLicenses.partyProfileId, profile.id))
      .orderBy(asc(partyLicenses.licenseType), asc(partyLicenses.createdAt));

    return rows as PartyLicense[];
  }
}
