import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { DrizzlePartyProfilesReads } from "./party-profiles.reads";
import {
  partyAddresses,
  partyContacts,
  partyIdentifiers,
  partyProfiles,
  partyLicenses,
  partyRepresentatives,
} from "./schema";
import { counterparties } from "../../../counterparties/adapters/drizzle/schema";
import { organizations } from "../../../organizations/adapters/drizzle/schema";
import {
  normalizeLocaleTextMap,
  type LocaleTextMap,
} from "../../../shared/domain/locale-map";
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
} from "../../application/contracts";
import type { PartyProfilesStore } from "../../application/ports/party-profiles.store";

function normalizeIdentifierValue(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeLocaleMap(
  value: Record<string, string | null> | null | undefined,
): LocaleTextMap | null {
  return normalizeLocaleTextMap(value) ?? null;
}

function ownerWhere(input: {
  ownerType: PartyProfileOwnerType;
  ownerId: string;
}) {
  return input.ownerType === "organization"
    ? eq(partyProfiles.organizationId, input.ownerId)
    : eq(partyProfiles.counterpartyId, input.ownerId);
}

export class DrizzlePartyProfilesStore implements PartyProfilesStore {
  constructor(private readonly db: Queryable) {}

  findBundleByOwner(input: {
    ownerType: PartyProfileOwnerType;
    ownerId: string;
  }): Promise<PartyProfileBundle | null> {
    return new DrizzlePartyProfilesReads(this.db).findBundleByOwner(input);
  }

  async upsertProfile(input: {
    ownerType: PartyProfileOwnerType;
    ownerId: string;
    profile: PartyProfileInput;
  }): Promise<PartyProfile> {
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
      businessActivityCode: input.profile.businessActivityCode,
      businessActivityText: input.profile.businessActivityText,
      businessActivityTextI18n: normalizeLocaleMap(
        input.profile.businessActivityTextI18n,
      ),
    };

    const [profile] = existing
      ? await this.db
          .update(partyProfiles)
          .set({
            ...values,
            updatedAt: sql`now()`,
          })
          .where(eq(partyProfiles.id, existing.id))
          .returning()
      : await this.db.insert(partyProfiles).values(values).returning();

    await this.refreshOwnerProjection({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      shortName: profile!.shortName,
      fullName: profile!.fullName,
      countryCode: profile!.countryCode ?? null,
    });

    return profile! as PartyProfile;
  }

  async replaceIdentifiers(input: {
    ownerType: PartyProfileOwnerType;
    ownerId: string;
    items: PartyIdentifierInput[];
  }): Promise<PartyIdentifier[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyIdentifiers)
      .where(eq(partyIdentifiers.partyProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyIdentifiers)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyProfileId: profile.id,
          scheme: item.scheme,
          value: item.value,
          normalizedValue: normalizeIdentifierValue(item.value),
        })),
      )
      .returning();

    return rows as PartyIdentifier[];
  }

  async replaceAddress(input: {
    ownerType: PartyProfileOwnerType;
    ownerId: string;
    item: PartyAddressInput | null;
  }): Promise<PartyAddress | null> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyAddresses)
      .where(eq(partyAddresses.partyProfileId, profile.id));

    if (!input.item) {
      return null;
    }

    const [row] = await this.db
      .insert(partyAddresses)
      .values({
        id: input.item.id,
        partyProfileId: profile.id,
        countryCode: input.item.countryCode,
        postalCode: input.item.postalCode,
        city: input.item.city,
        cityI18n: normalizeLocaleMap(input.item.cityI18n),
        streetAddress: input.item.streetAddress,
        streetAddressI18n: normalizeLocaleMap(input.item.streetAddressI18n),
        addressDetails: input.item.addressDetails,
        addressDetailsI18n: normalizeLocaleMap(input.item.addressDetailsI18n),
        fullAddress: input.item.fullAddress,
        fullAddressI18n: normalizeLocaleMap(input.item.fullAddressI18n),
      })
      .returning();

    return (row ?? null) as PartyAddress | null;
  }

  async replaceContacts(input: {
    ownerType: PartyProfileOwnerType;
    ownerId: string;
    items: PartyContactInput[];
  }): Promise<PartyContact[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyContacts)
      .where(eq(partyContacts.partyProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyContacts)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyProfileId: profile.id,
          type: item.type,
          value: item.value,
          isPrimary: item.isPrimary,
        })),
      )
      .returning();

    return rows as PartyContact[];
  }

  async replaceRepresentatives(input: {
    ownerType: PartyProfileOwnerType;
    ownerId: string;
    items: PartyRepresentativeInput[];
  }): Promise<PartyRepresentative[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyRepresentatives)
      .where(eq(partyRepresentatives.partyProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyRepresentatives)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyProfileId: profile.id,
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
    ownerType: PartyProfileOwnerType;
    ownerId: string;
    items: PartyLicenseInput[];
  }): Promise<PartyLicense[]> {
    const profile = await this.requireProfile(input);

    await this.db
      .delete(partyLicenses)
      .where(eq(partyLicenses.partyProfileId, profile.id));

    if (input.items.length === 0) {
      return [];
    }

    const rows = await this.db
      .insert(partyLicenses)
      .values(
        input.items.map((item) => ({
          id: item.id,
          partyProfileId: profile.id,
          licenseType: item.licenseType,
          licenseNumber: item.licenseNumber,
          issuedBy: item.issuedBy,
          issuedByI18n: normalizeLocaleMap(item.issuedByI18n),
          issuedAt: item.issuedAt,
          expiresAt: item.expiresAt,
          activityCode: item.activityCode,
          activityText: item.activityText,
          activityTextI18n: normalizeLocaleMap(item.activityTextI18n),
        })),
      )
      .returning();

    return rows as PartyLicense[];
  }

  private async findExistingProfile(input: {
    ownerType: PartyProfileOwnerType;
    ownerId: string;
  }) {
    const [row] = await this.db
      .select()
      .from(partyProfiles)
      .where(ownerWhere(input))
      .limit(1);

    return row ?? null;
  }

  private async requireProfile(input: {
    ownerType: PartyProfileOwnerType;
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
    ownerType: PartyProfileOwnerType;
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
