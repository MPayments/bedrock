import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { organizations } from "./schema";
import type { OrganizationStore } from "../../application/ports/organization.store";

function hasForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23503") {
    return true;
  }

  return hasForeignKeyViolation(candidate.cause);
}

export class DrizzleOrganizationStore implements OrganizationStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    return row ?? null;
  }

  async create(organization: {
    id: string;
    externalId: string | null;
    shortName: string;
    fullName: string;
    description: string | null;
    country: string | null;
    kind: "legal_entity" | "individual";
    isActive: boolean;
    nameI18n?: { ru?: string | null; en?: string | null } | null;
    orgType: string | null;
    orgTypeI18n?: { ru?: string | null; en?: string | null } | null;
    countryI18n?: { ru?: string | null; en?: string | null } | null;
    city: string | null;
    cityI18n?: { ru?: string | null; en?: string | null } | null;
    address: string | null;
    addressI18n?: { ru?: string | null; en?: string | null } | null;
    inn: string | null;
    taxId: string | null;
    kpp: string | null;
    ogrn: string | null;
    oktmo: string | null;
    okpo: string | null;
    directorName: string | null;
    directorNameI18n?: { ru?: string | null; en?: string | null } | null;
    directorPosition: string | null;
    directorPositionI18n?: { ru?: string | null; en?: string | null } | null;
    directorBasis: string | null;
    directorBasisI18n?: { ru?: string | null; en?: string | null } | null;
    signatureKey: string | null;
    sealKey: string | null;
  }) {
    const [created] = await this.db
      .insert(organizations)
      .values(organization)
      .returning();

    return created!;
  }

  async update(organization: {
    id: string;
    externalId: string | null;
    shortName: string;
    fullName: string;
    description: string | null;
    country: string | null;
    kind: "legal_entity" | "individual";
    isActive: boolean;
    nameI18n?: { ru?: string | null; en?: string | null } | null;
    orgType: string | null;
    orgTypeI18n?: { ru?: string | null; en?: string | null } | null;
    countryI18n?: { ru?: string | null; en?: string | null } | null;
    city: string | null;
    cityI18n?: { ru?: string | null; en?: string | null } | null;
    address: string | null;
    addressI18n?: { ru?: string | null; en?: string | null } | null;
    inn: string | null;
    taxId: string | null;
    kpp: string | null;
    ogrn: string | null;
    oktmo: string | null;
    okpo: string | null;
    directorName: string | null;
    directorNameI18n?: { ru?: string | null; en?: string | null } | null;
    directorPosition: string | null;
    directorPositionI18n?: { ru?: string | null; en?: string | null } | null;
    directorBasis: string | null;
    directorBasisI18n?: { ru?: string | null; en?: string | null } | null;
    signatureKey: string | null;
    sealKey: string | null;
  }) {
    const [updated] = await this.db
      .update(organizations)
      .set({
        externalId: organization.externalId,
        shortName: organization.shortName,
        fullName: organization.fullName,
        description: organization.description,
        country: organization.country,
        kind: organization.kind,
        isActive: organization.isActive,
        nameI18n: organization.nameI18n ?? null,
        orgType: organization.orgType,
        orgTypeI18n: organization.orgTypeI18n ?? null,
        countryI18n: organization.countryI18n ?? null,
        city: organization.city,
        cityI18n: organization.cityI18n ?? null,
        address: organization.address,
        addressI18n: organization.addressI18n ?? null,
        inn: organization.inn,
        taxId: organization.taxId,
        kpp: organization.kpp,
        ogrn: organization.ogrn,
        oktmo: organization.oktmo,
        okpo: organization.okpo,
        directorName: organization.directorName,
        directorNameI18n: organization.directorNameI18n ?? null,
        directorPosition: organization.directorPosition,
        directorPositionI18n: organization.directorPositionI18n ?? null,
        directorBasis: organization.directorBasis,
        directorBasisI18n: organization.directorBasisI18n ?? null,
        signatureKey: organization.signatureKey,
        sealKey: organization.sealKey,
        updatedAt: sql`now()`,
      })
      .where(eq(organizations.id, organization.id))
      .returning();

    return updated ?? null;
  }

  async remove(id: string) {
    try {
      const [deleted] = await this.db
        .update(organizations)
        .set({
          isActive: false,
          updatedAt: sql`now()`,
        })
        .where(eq(organizations.id, id))
        .returning({ id: organizations.id });

      return deleted ? "deleted" : "not_found";
    } catch (error) {
      if (hasForeignKeyViolation(error)) {
        return "conflict";
      }

      throw error;
    }
  }
}
