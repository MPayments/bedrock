import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  opsAgentBonus,
  opsDealDocuments,
  opsDeals,
} from "../../../infra/drizzle/schema";
import type {
  CreateDealInput,
  SetAgentBonusInput,
  UpdateDealDetailsInput,
} from "../../application/contracts/commands";
import type { AgentBonus, Deal } from "../../application/contracts/dto";
import type { DealStatus } from "../../domain/deal-status";
import type { DealStore } from "../../application/ports/deal.store";

export class DrizzleDealStore implements DealStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Deal | null> {
    const [row] = await this.db
      .select()
      .from(opsDeals)
      .where(eq(opsDeals.id, id))
      .limit(1);
    return (row as unknown as Deal) ?? null;
  }

  async findByApplicationId(applicationId: number): Promise<Deal | null> {
    const [row] = await this.db
      .select()
      .from(opsDeals)
      .where(eq(opsDeals.applicationId, applicationId))
      .limit(1);
    return (row as unknown as Deal) ?? null;
  }

  async create(input: CreateDealInput): Promise<Deal> {
    const [created] = await this.db
      .insert(opsDeals)
      .values({
        applicationId: input.applicationId,
        calculationId: input.calculationId,
        counterpartyId: input.counterpartyId ?? null,
        agentOrganizationBankDetailsId: input.agentOrganizationBankDetailsId,
        invoiceNumber: input.invoiceNumber ?? null,
        invoiceDate: input.invoiceDate ?? null,
        companyName: input.companyName ?? null,
        companyNameI18n: input.companyNameI18n ?? null,
        bankName: input.bankName ?? null,
        bankNameI18n: input.bankNameI18n ?? null,
        account: input.account ?? null,
        swiftCode: input.swiftCode ?? null,
        contractDate: input.contractDate ?? null,
        contractNumber: input.contractNumber ?? null,
        costPrice: input.costPrice ?? null,
        comment: input.comment ?? null,
        status: "preparing_documents",
      })
      .returning();
    return created! as unknown as Deal;
  }

  async updateStatus(
    id: number,
    status: DealStatus,
    closedAt?: string,
  ): Promise<Deal | null> {
    const set: Record<string, unknown> = {
      status,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    if (closedAt) {
      set.closedAt = closedAt;
    }

    const [updated] = await this.db
      .update(opsDeals)
      .set(set)
      .where(eq(opsDeals.id, id))
      .returning();
    return (updated as unknown as Deal) ?? null;
  }

  async updateDetails(input: UpdateDealDetailsInput): Promise<Deal | null> {
    const { id, ...data } = input;
    const [updated] = await this.db
      .update(opsDeals)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(opsDeals.id, id))
      .returning();
    return (updated as unknown as Deal) ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .delete(opsDeals)
      .where(eq(opsDeals.id, id))
      .returning({ id: opsDeals.id });
    return Boolean(deleted);
  }

  async insertAgentBonus(input: SetAgentBonusInput): Promise<AgentBonus> {
    const [created] = await this.db
      .insert(opsAgentBonus)
      .values({
        agentId: input.agentId,
        dealId: input.dealId,
        commission: input.commission,
      })
      .returning();
    return created! as unknown as AgentBonus;
  }
}
