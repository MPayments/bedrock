import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  opsAgentBonus,
  opsDeals,
} from "../../../infra/drizzle/schema";
import type {
  SetAgentBonusInput,
} from "../../application/contracts/commands";
import type { AgentBonus, Deal } from "../../application/contracts/dto";
import type { DealStore } from "../../application/ports/deal.store";

function mapDealRow(row: typeof opsDeals.$inferSelect): Deal {
  return {
    ...row,
    calculationId: row.calculationUuid ?? String(row.calculationId ?? ""),
  } as unknown as Deal;
}

export class DrizzleDealStore implements DealStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Deal | null> {
    const [row] = await this.db
      .select()
      .from(opsDeals)
      .where(eq(opsDeals.id, id))
      .limit(1);
    return row ? mapDealRow(row) : null;
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
