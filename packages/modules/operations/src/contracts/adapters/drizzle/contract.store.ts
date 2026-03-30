import { desc, eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsContracts } from "../../../infra/drizzle/schema";
import type { CreateContractInput, UpdateContractInput } from "../../application/contracts/commands";
import type { Contract } from "../../application/contracts/dto";
import type { ContractStore } from "../../application/ports/contract.store";

export class DrizzleContractStore implements ContractStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Contract | null> {
    const [row] = await this.db
      .select()
      .from(opsContracts)
      .where(eq(opsContracts.id, id))
      .limit(1);
    return (row as Contract) ?? null;
  }

  async findByClientId(clientId: number): Promise<Contract | null> {
    const [row] = await this.db
      .select()
      .from(opsContracts)
      .where(eq(opsContracts.clientId, clientId))
      .orderBy(desc(opsContracts.updatedAt), desc(opsContracts.id))
      .limit(1);
    return (row as Contract) ?? null;
  }

  async findByContractNumber(contractNumber: string): Promise<Contract | null> {
    const [row] = await this.db
      .select()
      .from(opsContracts)
      .where(eq(opsContracts.contractNumber, contractNumber))
      .limit(1);
    return (row as Contract) ?? null;
  }

  async create(input: CreateContractInput): Promise<Contract> {
    const [created] = await this.db
      .insert(opsContracts)
      .values({
        clientId: input.clientId,
        agentOrganizationId: input.agentOrganizationId,
        organizationRequisiteId: input.organizationRequisiteId,
        contractNumber: input.contractNumber,
        contractDate: input.contractDate,
        agentFee: input.agentFee,
        fixedFee: input.fixedFee,
      })
      .returning();
    return created! as Contract;
  }

  async update(input: UpdateContractInput): Promise<Contract | null> {
    const { id, ...data } = input;
    const [updated] = await this.db
      .update(opsContracts)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(opsContracts.id, id))
      .returning();
    return (updated as Contract) ?? null;
  }

  async softDelete(id: number): Promise<boolean> {
    const [row] = await this.db
      .update(opsContracts)
      .set({ isActive: false, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(opsContracts.id, id))
      .returning({ id: opsContracts.id });
    return Boolean(row);
  }

  async restore(id: number): Promise<boolean> {
    const [row] = await this.db
      .update(opsContracts)
      .set({ isActive: true, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(opsContracts.id, id))
      .returning({ id: opsContracts.id });
    return Boolean(row);
  }
}
