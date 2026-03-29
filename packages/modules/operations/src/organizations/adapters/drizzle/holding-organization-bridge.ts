import { desc, eq, inArray, sql } from "drizzle-orm";

import type { Organization } from "@bedrock/parties/contracts";
import type { Queryable } from "@bedrock/platform/persistence";
import { dedupeStrings } from "@bedrock/shared/core/domain";

import { opsAgentOrganizations } from "../../../infra/drizzle/schema/agents";

export type HoldingOrganizationBridgeRow =
  typeof opsAgentOrganizations.$inferSelect;

export class DrizzleHoldingOrganizationBridge {
  constructor(private readonly db: Queryable) {}

  async findByCanonicalOrganizationId(
    organizationId: string,
  ): Promise<HoldingOrganizationBridgeRow | null> {
    const [row] = await this.db
      .select()
      .from(opsAgentOrganizations)
      .where(eq(opsAgentOrganizations.organizationId, organizationId))
      .orderBy(desc(opsAgentOrganizations.id))
      .limit(1);

    return row ?? null;
  }

  async findByLegacyId(id: number): Promise<HoldingOrganizationBridgeRow | null> {
    const [row] = await this.db
      .select()
      .from(opsAgentOrganizations)
      .where(eq(opsAgentOrganizations.id, id))
      .limit(1);

    return row ?? null;
  }

  async listByLegacyIds(ids: number[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      return new Map<number, HoldingOrganizationBridgeRow>();
    }

    const rows = await this.db
      .select()
      .from(opsAgentOrganizations)
      .where(inArray(opsAgentOrganizations.id, uniqueIds))
      .orderBy(desc(opsAgentOrganizations.id));

    return new Map(rows.map((row) => [row.id, row] as const));
  }

  async listByCanonicalOrganizationIds(organizationIds: string[]) {
    const uniqueIds = dedupeStrings(organizationIds);
    if (uniqueIds.length === 0) {
      return new Map<string, HoldingOrganizationBridgeRow>();
    }

    const rows = await this.db
      .select()
      .from(opsAgentOrganizations)
      .where(inArray(opsAgentOrganizations.organizationId, uniqueIds))
      .orderBy(desc(opsAgentOrganizations.id));

    return new Map(
      rows
        .filter((row) => Boolean(row.organizationId))
        .map((row) => [row.organizationId!, row] as const),
    );
  }

  async upsertFromCanonical(
    organization: Organization,
  ): Promise<HoldingOrganizationBridgeRow> {
    const values = {
      address: organization.address,
      addressI18n: organization.addressI18n ?? null,
      city: organization.city,
      cityI18n: organization.cityI18n ?? null,
      country: organization.country,
      countryI18n: organization.countryI18n ?? null,
      directorBasis: organization.directorBasis,
      directorBasisI18n: organization.directorBasisI18n ?? null,
      directorName: organization.directorName,
      directorNameI18n: organization.directorNameI18n ?? null,
      directorPosition: organization.directorPosition,
      directorPositionI18n: organization.directorPositionI18n ?? null,
      inn: organization.inn,
      isActive: organization.isActive,
      kpp: organization.kpp,
      name: organization.shortName,
      nameI18n: organization.nameI18n ?? null,
      ogrn: organization.ogrn,
      okpo: organization.okpo,
      oktmo: organization.oktmo,
      organizationId: organization.id,
      orgType: organization.orgType,
      orgTypeI18n: organization.orgTypeI18n ?? null,
      sealKey: organization.sealKey,
      signatureKey: organization.signatureKey,
      taxId: organization.taxId,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    const existing = await this.findByCanonicalOrganizationId(organization.id);
    if (existing) {
      const [updated] = await this.db
        .update(opsAgentOrganizations)
        .set(values)
        .where(eq(opsAgentOrganizations.id, existing.id))
        .returning();

      return updated ?? existing;
    }

    const [created] = await this.db
      .insert(opsAgentOrganizations)
      .values(values)
      .returning();

    return created!;
  }

  async archiveByCanonicalOrganizationId(organizationId: string) {
    const [updated] = await this.db
      .update(opsAgentOrganizations)
      .set({
        isActive: false,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(opsAgentOrganizations.organizationId, organizationId))
      .returning({ id: opsAgentOrganizations.id });

    return Boolean(updated);
  }
}
