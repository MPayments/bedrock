import {
  Entity,
  invariant,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core/domain";

import { parseCountryCode, type CountryCode, type PartyKind } from "./party-kind";

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
  externalId?: string | null;
  shortName: string;
  fullName: string;
  description?: string | null;
  country?: string | null;
  kind: PartyKind;
}

export interface UpdateOrganizationProps {
  externalId?: string | null;
  shortName?: string;
  fullName?: string;
  description?: string | null;
  country?: string | null;
  kind?: PartyKind;
}

function normalizeCountry(
  value: string | null | undefined,
): CountryCode | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? parseCountryCode(normalized) : null;
}

export class Organization extends Entity<string> {
  private constructor(private readonly snapshot: OrganizationSnapshot) {
    super(snapshot.id);
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
      country: normalizeCountry(input.country),
      kind: input.kind,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(snapshot: OrganizationSnapshot): Organization {
    return new Organization({
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
      country: normalizeCountry(snapshot.country),
    });
  }

  update(input: UpdateOrganizationProps, now: Date): Organization {
    return new Organization({
      ...this.snapshot,
      externalId:
        input.externalId !== undefined
          ? normalizeOptionalText(input.externalId)
          : this.snapshot.externalId,
      shortName:
        input.shortName !== undefined
          ? normalizeRequiredText(
              input.shortName,
              "organization.short_name_required",
              "shortName",
            )
          : this.snapshot.shortName,
      fullName:
        input.fullName !== undefined
          ? normalizeRequiredText(
              input.fullName,
              "organization.full_name_required",
              "fullName",
            )
          : this.snapshot.fullName,
      description:
        input.description !== undefined
          ? normalizeOptionalText(input.description)
          : this.snapshot.description,
      country:
        input.country !== undefined
          ? normalizeCountry(input.country)
          : this.snapshot.country,
      kind: input.kind ?? this.snapshot.kind,
      updatedAt: now,
    });
  }

  sameState(other: Organization): boolean {
    return this.snapshot.externalId === other.snapshot.externalId &&
      this.snapshot.shortName === other.snapshot.shortName &&
      this.snapshot.fullName === other.snapshot.fullName &&
      this.snapshot.description === other.snapshot.description &&
      this.snapshot.country === other.snapshot.country &&
      this.snapshot.kind === other.snapshot.kind;
  }

  toSnapshot(): OrganizationSnapshot {
    return { ...this.snapshot };
  }
}
