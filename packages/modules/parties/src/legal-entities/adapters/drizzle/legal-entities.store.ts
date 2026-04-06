import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  normalizeLocaleTextMap,
  type LocaleTextMap,
} from "../../../shared/domain/locale-map";
import { counterparties } from "../../../counterparties/adapters/drizzle/schema";
import { organizations } from "../../../organizations/adapters/drizzle/schema";
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
} from "../../application/contracts";
import type { LegalEntitiesStore } from "../../application/ports/legal-entities.store";
import { DrizzleLegalEntitiesReads } from "./legal-entities.reads";
import {
  partyAddresses,
  partyContacts,
  partyLegalIdentifiers,
  partyLegalProfiles,
  partyLicenses,
  partyRepresentatives,
} from "./schema";

function normalizeIdentifierValue(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeLocaleMap(
  value: Record<string, string | null> | null | undefined,
): LocaleTextMap | null {
  return normalizeLocaleTextMap(value) ?? null;
}

function ownerWhere(input: {
  ownerType: PartyLegalOwnerType;
  ownerId: string;
}) {
  return input.ownerType === "organization"
    ? eq(partyLegalProfiles.organizationId, input.ownerId)
    : eq(partyLegalProfiles.counterpartyId, input.ownerId);
}

export class DrizzleLegalEntitiesStore implements LegalEntitiesStore {
  constructor(private readonly db: Queryable) {}

  findBundleByOwner(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
  }): Promise<PartyLegalEntityBundle | null> {
    return new DrizzleLegalEntitiesReads(this.db).findBundleByOwner(input);
  }

  async upsertProfile(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    profile: PartyLegalProfileInput;
  }): Promise<PartyLegalProfile> {
    const existing = await this.findExistingProfile(input);
    const ownerColumns =
      input.ownerType === "organization"
        ? { organizationId: input.ownerId, counterpartyId: null }
        : { organizationId: null, counterpartyId: input.ownerId };

    const values = {
      ...ownerColumns,
      fullName: input.profile.fullName,
      shortName: input.profile.shortName,
      fullNameI18n: normalizeLocaleMap(input.profile.fullNameI18n),
      shortNameI18n: normalizeLocaleMap(input.profile.shortNameI18n),
      legalFormCode: input.profile.legalFormCode,
      legalFormLabel: input.profile.legalFormLabel,
      legalFormLabelI18n: normalizeLocaleMap(input.profile.legalFormLabelI18n),
      countryCode: input.profile.countryCode,
      jurisdictionCode: input.profile.jurisdictionCode,
      registrationAuthority: input.profile.registrationAuthority,
      registeredAt: input.profile.registeredAt,
      businessActivityCode: input.profile.businessActivityCode,
      businessActivityText: input.profile.businessActivityText,
      status: input.profile.status,
    };

    const [profile] = existing
      ? await this.db
          .update(partyLegalProfiles)
          .set({
            ...values,
            updatedAt: sql`now()`,
          })
          .where(eq(partyLegalProfiles.id, existing.id))
          .returning()
      : await this.db.insert(partyLegalProfiles).values(values).returning();

    await this.refreshOwnerProjection({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      shortName: profile!.shortName,
      fullName: profile!.fullName,
      countryCode: profile!.countryCode ?? null,
    });

    return profile! as PartyLegalProfile;
  }

  async replaceIdentifiers(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyLegalIdentifierInput[];
  }): Promise<PartyLegalIdentifier[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyLegalIdentifiers)
      .where(eq(partyLegalIdentifiers.partyLegalProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyLegalIdentifiers)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyLegalProfileId: profile.id,
          scheme: item.scheme,
          value: item.value,
          normalizedValue: normalizeIdentifierValue(item.value),
          jurisdictionCode: item.jurisdictionCode,
          issuer: item.issuer,
          isPrimary: item.isPrimary,
          validFrom: item.validFrom,
          validTo: item.validTo,
        })),
      )
      .returning();

    return rows as PartyLegalIdentifier[];
  }

  async replaceAddresses(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyAddressInput[];
  }): Promise<PartyAddress[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyAddresses)
      .where(eq(partyAddresses.partyLegalProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyAddresses)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyLegalProfileId: profile.id,
          type: item.type,
          label: item.label,
          countryCode: item.countryCode,
          jurisdictionCode: item.jurisdictionCode,
          postalCode: item.postalCode,
          city: item.city,
          line1: item.line1,
          line2: item.line2,
          rawText: item.rawText,
          isPrimary: item.isPrimary,
        })),
      )
      .returning();

    return rows as PartyAddress[];
  }

  async replaceContacts(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyContactInput[];
  }): Promise<PartyContact[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyContacts)
      .where(eq(partyContacts.partyLegalProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyContacts)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyLegalProfileId: profile.id,
          type: item.type,
          label: item.label,
          value: item.value,
          isPrimary: item.isPrimary,
        })),
      )
      .returning();

    return rows as PartyContact[];
  }

  async replaceRepresentatives(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyRepresentativeInput[];
  }): Promise<PartyRepresentative[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyRepresentatives)
      .where(eq(partyRepresentatives.partyLegalProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyRepresentatives)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyLegalProfileId: profile.id,
          role: item.role,
          fullName: item.fullName,
          fullNameI18n: normalizeLocaleMap(item.fullNameI18n),
          title: item.title,
          titleI18n: normalizeLocaleMap(item.titleI18n),
          basisDocument: item.basisDocument,
          basisDocumentI18n: normalizeLocaleMap(item.basisDocumentI18n),
          isPrimary: item.isPrimary,
        })),
      )
      .returning();

    return rows as PartyRepresentative[];
  }

  async replaceLicenses(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    items: PartyLicenseInput[];
  }): Promise<PartyLicense[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyLicenses)
      .where(eq(partyLicenses.partyLegalProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyLicenses)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyLegalProfileId: profile.id,
          licenseType: item.licenseType,
          licenseNumber: item.licenseNumber,
          issuedBy: item.issuedBy,
          issuedAt: item.issuedAt,
          expiresAt: item.expiresAt,
          activityCode: item.activityCode,
          activityText: item.activityText,
        })),
      )
      .returning();

    return rows as PartyLicense[];
  }

  private async findExistingProfile(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
  }) {
    const [row] = await this.db
      .select()
      .from(partyLegalProfiles)
      .where(ownerWhere(input))
      .limit(1);

    return row ?? null;
  }

  private async requireProfile(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
  }) {
    const profile = await this.findExistingProfile(input);

    if (!profile) {
      throw new Error(
        `Missing legal profile for ${input.ownerType}:${input.ownerId}`,
      );
    }

    return profile;
  }

  private async refreshOwnerProjection(input: {
    ownerType: PartyLegalOwnerType;
    ownerId: string;
    shortName: string;
    fullName: string;
    countryCode: string | null;
  }) {
    if (input.ownerType === "organization") {
      await this.db
        .update(organizations)
        .set({
          shortName: input.shortName,
          fullName: input.fullName,
          country: input.countryCode,
          updatedAt: sql`now()`,
        })
        .where(eq(organizations.id, input.ownerId));
      return;
    }

    await this.db
      .update(counterparties)
      .set({
        shortName: input.shortName,
        fullName: input.fullName,
        country: input.countryCode,
        updatedAt: sql`now()`,
      })
      .where(eq(counterparties.id, input.ownerId));
  }
}
