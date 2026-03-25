import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsAgentOrganizations } from "../../../infra/drizzle/schema/agents";
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
} from "../../application/contracts/commands";
import type { Organization } from "../../application/contracts/dto";
import type { OrganizationStore } from "../../application/ports/organization.store";

export class DrizzleOrganizationStore implements OrganizationStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Organization | null> {
    const [row] = await this.db
      .select()
      .from(opsAgentOrganizations)
      .where(eq(opsAgentOrganizations.id, id))
      .limit(1);
    return (row as Organization) ?? null;
  }

  async create(input: CreateOrganizationInput): Promise<Organization> {
    const [created] = await this.db
      .insert(opsAgentOrganizations)
      .values({
        name: input.name,
        nameI18n: input.nameI18n,
        orgType: input.orgType,
        orgTypeI18n: input.orgTypeI18n,
        country: input.country,
        countryI18n: input.countryI18n,
        city: input.city,
        cityI18n: input.cityI18n,
        address: input.address,
        addressI18n: input.addressI18n,
        inn: input.inn,
        taxId: input.taxId,
        kpp: input.kpp,
        ogrn: input.ogrn,
        oktmo: input.oktmo,
        okpo: input.okpo,
        directorName: input.directorName,
        directorNameI18n: input.directorNameI18n,
        directorPosition: input.directorPosition,
        directorPositionI18n: input.directorPositionI18n,
        directorBasis: input.directorBasis,
        directorBasisI18n: input.directorBasisI18n,
        signatureKey: input.signatureKey,
        sealKey: input.sealKey,
      })
      .returning();
    return created! as Organization;
  }

  async update(input: UpdateOrganizationInput): Promise<Organization | null> {
    const values: Record<string, unknown> = {};

    if (input.name !== undefined) values.name = input.name;
    if (input.nameI18n !== undefined) values.nameI18n = input.nameI18n;
    if (input.orgType !== undefined) values.orgType = input.orgType;
    if (input.orgTypeI18n !== undefined) values.orgTypeI18n = input.orgTypeI18n;
    if (input.country !== undefined) values.country = input.country;
    if (input.countryI18n !== undefined) values.countryI18n = input.countryI18n;
    if (input.city !== undefined) values.city = input.city;
    if (input.cityI18n !== undefined) values.cityI18n = input.cityI18n;
    if (input.address !== undefined) values.address = input.address;
    if (input.addressI18n !== undefined) values.addressI18n = input.addressI18n;
    if (input.inn !== undefined) values.inn = input.inn;
    if (input.taxId !== undefined) values.taxId = input.taxId;
    if (input.kpp !== undefined) values.kpp = input.kpp;
    if (input.ogrn !== undefined) values.ogrn = input.ogrn;
    if (input.oktmo !== undefined) values.oktmo = input.oktmo;
    if (input.okpo !== undefined) values.okpo = input.okpo;
    if (input.directorName !== undefined)
      values.directorName = input.directorName;
    if (input.directorNameI18n !== undefined)
      values.directorNameI18n = input.directorNameI18n;
    if (input.directorPosition !== undefined)
      values.directorPosition = input.directorPosition;
    if (input.directorPositionI18n !== undefined)
      values.directorPositionI18n = input.directorPositionI18n;
    if (input.directorBasis !== undefined)
      values.directorBasis = input.directorBasis;
    if (input.directorBasisI18n !== undefined)
      values.directorBasisI18n = input.directorBasisI18n;
    if (input.signatureKey !== undefined)
      values.signatureKey = input.signatureKey;
    if (input.sealKey !== undefined) values.sealKey = input.sealKey;

    const [updated] = await this.db
      .update(opsAgentOrganizations)
      .set(values)
      .where(eq(opsAgentOrganizations.id, input.id))
      .returning();
    return (updated as Organization) ?? null;
  }

  async softDelete(id: number): Promise<boolean> {
    const [row] = await this.db
      .update(opsAgentOrganizations)
      .set({ isActive: false })
      .where(eq(opsAgentOrganizations.id, id))
      .returning({ id: opsAgentOrganizations.id });
    return Boolean(row);
  }

  async restore(id: number): Promise<boolean> {
    const [row] = await this.db
      .update(opsAgentOrganizations)
      .set({ isActive: true })
      .where(eq(opsAgentOrganizations.id, id))
      .returning({ id: opsAgentOrganizations.id });
    return Boolean(row);
  }
}
