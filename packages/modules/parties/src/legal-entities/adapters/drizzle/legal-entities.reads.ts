import { asc, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type { LegalEntitiesReads } from "../../application/ports/legal-entities.reads";
import {
  partyAddresses,
  partyContacts,
  partyLegalIdentifiers,
  partyLegalProfiles,
  partyLicenses,
  partyRepresentatives,
} from "./schema";

function profileOwnerWhere(input: {
  ownerType: "organization" | "counterparty";
  ownerId: string;
}) {
  return input.ownerType === "organization"
    ? eq(partyLegalProfiles.organizationId, input.ownerId)
    : eq(partyLegalProfiles.counterpartyId, input.ownerId);
}

export class DrizzleLegalEntitiesReads implements LegalEntitiesReads {
  constructor(private readonly db: Queryable) {}

  async findBundleByOwner(input: {
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }) {
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

  async findProfileByOwner(input: {
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }) {
    const [row] = await this.db
      .select()
      .from(partyLegalProfiles)
      .where(profileOwnerWhere(input))
      .limit(1);

    return row ?? null;
  }

  async listIdentifiersByOwner(input: {
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }) {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    return this.db
      .select()
      .from(partyLegalIdentifiers)
      .where(eq(partyLegalIdentifiers.partyLegalProfileId, profile.id))
      .orderBy(
        asc(partyLegalIdentifiers.scheme),
        asc(partyLegalIdentifiers.createdAt),
      );
  }

  async listAddressesByOwner(input: {
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }) {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    return this.db
      .select()
      .from(partyAddresses)
      .where(eq(partyAddresses.partyLegalProfileId, profile.id))
      .orderBy(asc(partyAddresses.type), asc(partyAddresses.createdAt));
  }

  async listContactsByOwner(input: {
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }) {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    return this.db
      .select()
      .from(partyContacts)
      .where(eq(partyContacts.partyLegalProfileId, profile.id))
      .orderBy(asc(partyContacts.type), asc(partyContacts.createdAt));
  }

  async listRepresentativesByOwner(input: {
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }) {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    return this.db
      .select()
      .from(partyRepresentatives)
      .where(eq(partyRepresentatives.partyLegalProfileId, profile.id))
      .orderBy(
        asc(partyRepresentatives.role),
        asc(partyRepresentatives.createdAt),
      );
  }

  async listLicensesByOwner(input: {
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }) {
    const profile = await this.findProfileByOwner(input);
    if (!profile) {
      return [];
    }

    return this.db
      .select()
      .from(partyLicenses)
      .where(eq(partyLicenses.partyLegalProfileId, profile.id))
      .orderBy(asc(partyLicenses.licenseType), asc(partyLicenses.createdAt));
  }
}

