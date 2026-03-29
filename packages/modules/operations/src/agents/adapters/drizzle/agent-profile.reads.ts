import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import { user } from "@bedrock/iam/schema";
import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import type { AgentProfile } from "../../application/contracts/dto";
import type { ListAgentsQuery } from "../../application/contracts/queries";
import type { AgentProfileReads } from "../../application/ports/agent-profile.reads";

const AGENT_SORT_COLUMN_MAP = {
  name: user.name,
  createdAt: user.createdAt,
} as const;

export class DrizzleAgentProfileReads implements AgentProfileReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<AgentProfile | null> {
    const [row] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return (row as AgentProfile) ?? null;
  }

  async findByTgId(tgId: number): Promise<AgentProfile | null> {
    const [row] = await this.db
      .select()
      .from(user)
      .where(eq(user.tgId, tgId))
      .limit(1);
    return (row as AgentProfile) ?? null;
  }

  async findByEmail(email: string): Promise<AgentProfile | null> {
    const [row] = await this.db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    return (row as AgentProfile) ?? null;
  }

  async list(input: ListAgentsQuery): Promise<PaginatedList<AgentProfile>> {
    const conditions: SQL[] = [];

    // Only show users with agent-related roles
    conditions.push(
      sql`(${user.role} = 'agent' OR ${user.role} = 'admin' OR ${user.role} IS NULL)`,
    );

    if (input.status) {
      conditions.push(eq(user.status, input.status));
    }
    if (input.isAllowed !== undefined) {
      conditions.push(eq(user.isAllowed, input.isAllowed));
    }
    if (input.isAdmin !== undefined) {
      conditions.push(eq(user.isAdmin, input.isAdmin));
    }
    if (input.role) {
      conditions.push(eq(user.role, input.role));
    }
    if (input.name) {
      conditions.push(ilike(user.name, `%${input.name}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      AGENT_SORT_COLUMN_MAP,
      user.name,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(user)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(user)
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
      .from(user)
      .where(
        and(
          eq(user.isAllowed, true),
          eq(user.status, "active"),
        ),
      )
      .orderBy(asc(user.name));
    return rows as AgentProfile[];
  }
}
