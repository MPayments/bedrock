import { and, asc, desc, ilike, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsSubAgents } from "../../../infra/drizzle/schema";
import type { SubAgent } from "../../application/contracts/sub-agent-dto";
import type { ListSubAgentsQuery } from "../../application/contracts/sub-agent-queries";
import type { SubAgentReads } from "../../application/ports/sub-agent.reads";

const SUB_AGENT_SORT_COLUMN_MAP = {
  name: opsSubAgents.name,
  commission: opsSubAgents.commission,
} as const;

export class DrizzleSubAgentReads implements SubAgentReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<SubAgent | null> {
    const [row] = await this.db
      .select()
      .from(opsSubAgents)
      .where(sql`${opsSubAgents.id} = ${id}`)
      .limit(1);
    return (row as SubAgent) ?? null;
  }

  async list(input: ListSubAgentsQuery): Promise<PaginatedList<SubAgent>> {
    const conditions: SQL[] = [];

    if (input.name) {
      conditions.push(ilike(opsSubAgents.name, `%${input.name}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      SUB_AGENT_SORT_COLUMN_MAP,
      opsSubAgents.name,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsSubAgents)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsSubAgents)
        .where(where),
    ]);

    return {
      data: rows as SubAgent[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
