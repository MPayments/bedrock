import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { user } from "./schema/auth-schema";
import { agentProfiles } from "./schema/business-schema";
import { AGENT_PROFILE_ROLE_VALUES } from "../../domain/user-role";

type IamAgentProfileRecord = {
  id: string;
  tgId: number | null;
  userName: string | null;
  name: string;
  tag: string | null;
  status: string | null;
  isAllowed: boolean | null;
  isAdmin: boolean | null;
  role: string | null;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

type IamListAgentsInput = {
  limit: number;
  offset: number;
  sortBy?: "name" | "createdAt";
  sortOrder?: "asc" | "desc";
  status?: string;
  isAllowed?: boolean;
  isAdmin?: boolean;
  role?: string;
  name?: string;
};

const AGENT_SORT_COLUMN_MAP = {
  name: user.name,
  createdAt: user.createdAt,
} as const;

const agentProfileSelect = {
  id: user.id,
  tgId: agentProfiles.tgId,
  userName: agentProfiles.userName,
  name: user.name,
  tag: agentProfiles.tag,
  status: agentProfiles.status,
  isAllowed: agentProfiles.isAllowed,
  isAdmin: sql<boolean>`coalesce(${user.role} = 'admin', false)`,
  role: user.role,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
};

export class DrizzleIamAgentProfileReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<IamAgentProfileRecord | null> {
    const [row] = await this.db
      .select(agentProfileSelect)
      .from(user)
      .leftJoin(agentProfiles, eq(agentProfiles.userId, user.id))
      .where(eq(user.id, id))
      .limit(1);

    return row ?? null;
  }

  async findByTgId(tgId: number): Promise<IamAgentProfileRecord | null> {
    const [row] = await this.db
      .select(agentProfileSelect)
      .from(user)
      .innerJoin(agentProfiles, eq(agentProfiles.userId, user.id))
      .where(eq(agentProfiles.tgId, tgId))
      .limit(1);

    return row ?? null;
  }

  async findByEmail(email: string): Promise<IamAgentProfileRecord | null> {
    const [row] = await this.db
      .select(agentProfileSelect)
      .from(user)
      .leftJoin(agentProfiles, eq(agentProfiles.userId, user.id))
      .where(eq(user.email, email))
      .limit(1);

    return row ?? null;
  }

  async list(
    input: IamListAgentsInput,
  ): Promise<PaginatedList<IamAgentProfileRecord>> {
    const conditions: SQL[] = [];

    conditions.push(
      or(inArray(user.role, AGENT_PROFILE_ROLE_VALUES), isNull(user.role))!,
    );

    if (input.status) {
      conditions.push(eq(agentProfiles.status, input.status));
    }
    if (input.isAllowed !== undefined) {
      conditions.push(eq(agentProfiles.isAllowed, input.isAllowed));
    }
    if (input.isAdmin !== undefined) {
      conditions.push(
        input.isAdmin
          ? eq(user.role, "admin")
          : sql`coalesce(${user.role} <> 'admin', true)`,
      );
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
        .select(agentProfileSelect)
        .from(user)
        .leftJoin(agentProfiles, eq(agentProfiles.userId, user.id))
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(user)
        .leftJoin(agentProfiles, eq(agentProfiles.userId, user.id))
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async listAllowed(): Promise<IamAgentProfileRecord[]> {
    return this.db
      .select(agentProfileSelect)
      .from(user)
      .innerJoin(agentProfiles, eq(agentProfiles.userId, user.id))
      .where(
        and(
          eq(agentProfiles.isAllowed, true),
          eq(agentProfiles.status, "active"),
        ),
      )
      .orderBy(asc(user.name));
  }
}
