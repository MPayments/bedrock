import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsAgents } from "../../../infra/drizzle/schema";
import type { AgentProfile } from "../../application/contracts/dto";
import type { ListAgentsQuery } from "../../application/contracts/queries";
import type { AgentProfileReads } from "../../application/ports/agent-profile.reads";

const AGENT_SORT_COLUMN_MAP = {
  name: opsAgents.name,
  createdAt: opsAgents.createdAt,
} as const;

export class DrizzleAgentProfileReads implements AgentProfileReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<AgentProfile | null> {
    const [row] = await this.db
      .select()
      .from(opsAgents)
      .where(eq(opsAgents.id, id))
      .limit(1);
    return (row as AgentProfile) ?? null;
  }

  async findByTgId(tgId: number): Promise<AgentProfile | null> {
    const [row] = await this.db
      .select()
      .from(opsAgents)
      .where(eq(opsAgents.tgId, tgId))
      .limit(1);
    return (row as AgentProfile) ?? null;
  }

  async findByEmail(email: string): Promise<AgentProfile | null> {
    const [row] = await this.db
      .select()
      .from(opsAgents)
      .where(eq(opsAgents.email, email))
      .limit(1);
    return (row as AgentProfile) ?? null;
  }

  async list(input: ListAgentsQuery): Promise<PaginatedList<AgentProfile>> {
    const conditions: SQL[] = [];

    if (input.status) {
      conditions.push(eq(opsAgents.status, input.status));
    }
    if (input.isAllowed !== undefined) {
      conditions.push(eq(opsAgents.isAllowed, input.isAllowed));
    }
    if (input.isAdmin !== undefined) {
      conditions.push(eq(opsAgents.isAdmin, input.isAdmin));
    }
    if (input.role) {
      conditions.push(eq(opsAgents.role, input.role));
    }
    if (input.name) {
      conditions.push(ilike(opsAgents.name, `%${input.name}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      AGENT_SORT_COLUMN_MAP,
      opsAgents.name,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsAgents)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsAgents)
        .where(where),
    ]);

    return {
      data: rows as AgentProfile[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async listAllowed(): Promise<AgentProfile[]> {
    const rows = await this.db
      .select()
      .from(opsAgents)
      .where(
        and(
          eq(opsAgents.isAllowed, true),
          eq(opsAgents.status, "active"),
        ),
      )
      .orderBy(asc(opsAgents.name));
    return rows as AgentProfile[];
  }
}
