import { and, desc, eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsClients } from "../../../infra/drizzle/schema";
import type { CreateClientInput, UpdateClientInput } from "../../application/contracts/commands";
import type { Client } from "../../application/contracts/dto";
import type { ClientStore } from "../../application/ports/client.store";

export class DrizzleClientStore implements ClientStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Client | null> {
    const [row] = await this.db
      .select()
      .from(opsClients)
      .where(eq(opsClients.id, id))
      .limit(1);
    return (row as unknown as Client) ?? null;
  }

  async findActiveByCounterpartyId(counterpartyId: string): Promise<Client | null> {
    const [row] = await this.db
      .select()
      .from(opsClients)
      .where(
        and(
          eq(opsClients.counterpartyId, counterpartyId),
          eq(opsClients.isDeleted, false),
        ),
      )
      .orderBy(desc(opsClients.updatedAt), desc(opsClients.createdAt))
      .limit(1);
    return (row as unknown as Client) ?? null;
  }

  async create(input: CreateClientInput): Promise<Client> {
    const [created] = await this.db
      .insert(opsClients)
      .values({
        orgName: input.orgName,
        orgNameI18n: input.orgNameI18n ?? null,
        orgType: input.orgType ?? null,
        orgTypeI18n: input.orgTypeI18n ?? null,
        directorName: input.directorName ?? null,
        directorNameI18n: input.directorNameI18n ?? null,
        position: input.position ?? null,
        positionI18n: input.positionI18n ?? null,
        directorBasis: input.directorBasis ?? null,
        directorBasisI18n: input.directorBasisI18n ?? null,
        address: input.address ?? null,
        addressI18n: input.addressI18n ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        inn: input.inn ?? null,
        kpp: input.kpp ?? null,
        ogrn: input.ogrn ?? null,
        oktmo: input.oktmo ?? null,
        okpo: input.okpo ?? null,
        bankName: input.bankName ?? null,
        bankNameI18n: input.bankNameI18n ?? null,
        bankAddress: input.bankAddress ?? null,
        bankAddressI18n: input.bankAddressI18n ?? null,
        account: input.account ?? null,
        bic: input.bic ?? null,
        corrAccount: input.corrAccount ?? null,
        bankCountry: input.bankCountry ?? null,
        subAgentCounterpartyId: input.subAgentCounterpartyId ?? null,
        contractId: input.contractId ?? null,
        customerId: input.customerId ?? null,
        counterpartyId: input.counterpartyId ?? null,
      })
      .returning();
    return created! as unknown as Client;
  }

  async update(input: UpdateClientInput): Promise<Client | null> {
    const { id, ...data } = input;
    const [updated] = await this.db
      .update(opsClients)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(opsClients.id, id))
      .returning();
    return (updated as unknown as Client) ?? null;
  }

  async softDelete(id: number): Promise<boolean> {
    const [row] = await this.db
      .update(opsClients)
      .set({ isDeleted: true, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(opsClients.id, id))
      .returning({ id: opsClients.id });
    return Boolean(row);
  }

  async restore(id: number): Promise<boolean> {
    const [row] = await this.db
      .update(opsClients)
      .set({ isDeleted: false, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(opsClients.id, id))
      .returning({ id: opsClients.id });
    return Boolean(row);
  }
}
