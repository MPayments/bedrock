import {
  applyPatch,
  Entity,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core";

import {
  parseOptionalCountryCode,
  type CountryCode,
  type PartyKind,
} from "./party-kind";

export interface OrganizationSnapshot {
  id: string;
  externalId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: CountryCode | null;
  kind: PartyKind;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationProps {
  id: string;
  externalId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: string | null;
  kind: PartyKind;
}

export interface UpdateOrganizationProps {
  externalId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: string | null;
  kind: PartyKind;
}

function normalizeOrganizationSnapshot(
  snapshot: OrganizationSnapshot,
): OrganizationSnapshot {
  return {
    ...snapshot,
    externalId: normalizeOptionalText(snapshot.externalId),
    shortName: normalizeRequiredText(
      snapshot.shortName,
      "organization.short_name_required",
      "shortName",
    ),
    fullName: normalizeRequiredText(
      snapshot.fullName,
      "organization.full_name_required",
      "fullName",
    ),
    description: normalizeOptionalText(snapshot.description),
    country: parseOptionalCountryCode(snapshot.country),
  };
}

export class Organization extends Entity<string> {
  private readonly snapshot: OrganizationSnapshot;

  private constructor(snapshot: OrganizationSnapshot) {
    super(snapshot.id);
    this.snapshot = normalizeOrganizationSnapshot(snapshot);
  }

  static create(input: CreateOrganizationProps, now: Date): Organization {
    return new Organization({
      id: input.id,
      externalId: normalizeOptionalText(input.externalId),
      shortName: normalizeRequiredText(
        input.shortName,
        "organization.short_name_required",
        "shortName",
      ),
      fullName: normalizeRequiredText(
        input.fullName,
        "organization.full_name_required",
        "fullName",
      ),
      description: normalizeOptionalText(input.description),
      country: parseOptionalCountryCode(input.country),
      kind: input.kind,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromSnapshot(snapshot: OrganizationSnapshot): Organization {
    return new Organization({ ...snapshot });
  }

  update(input: Partial<UpdateOrganizationProps>, now: Date): Organization {
    return new Organization({
      ...applyPatch<OrganizationSnapshot>(
        this.snapshot,
        input as Partial<OrganizationSnapshot>,
      ),
      updatedAt: now,
    });
  }

  sameState(other: Organization): boolean {
    return (
      this.snapshot.externalId === other.snapshot.externalId &&
      this.snapshot.shortName === other.snapshot.shortName &&
      this.snapshot.fullName === other.snapshot.fullName &&
      this.snapshot.description === other.snapshot.description &&
      this.snapshot.country === other.snapshot.country &&
      this.snapshot.kind === other.snapshot.kind
    );
  }

  toSnapshot(): OrganizationSnapshot {
    return { ...this.snapshot };
  }
}
