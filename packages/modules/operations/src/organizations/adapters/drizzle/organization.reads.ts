import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsAgentOrganizations } from "../../../infra/drizzle/schema/agents";
import type { Organization } from "../../application/contracts/dto";
import type { ListOrganizationsQuery } from "../../application/contracts/queries";
import type { OrganizationReads } from "../../application/ports/organization.reads";

const ORG_SORT_COLUMN_MAP = {
  name: opsAgentOrganizations.name,
  createdAt: opsAgentOrganizations.createdAt,
} as const;

export class DrizzleOrganizationReads implements OrganizationReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Organization | null> {
    const [row] = await this.db
      .select()
      .from(opsAgentOrganizations)
      .where(eq(opsAgentOrganizations.id, id))
      .limit(1);
    return (row as Organization) ?? null;
  }

  async findByName(name: string): Promise<Organization | null> {
    const [row] = await this.db
      .select()
      .from(opsAgentOrganizations)
      .where(eq(opsAgentOrganizations.name, name))
      .limit(1);
    return (row as Organization) ?? null;
  }

  async list(
    input: ListOrganizationsQuery,
  ): Promise<PaginatedList<Organization>> {
    const conditions: SQL[] = [];

    if (input.name) {
      conditions.push(
        ilike(opsAgentOrganizations.name, `%${input.name}%`),
      );
    }
    const isActive = input.isActive ?? true;
    conditions.push(
      eq(opsAgentOrganizations.isActive, isActive),
    );

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      ORG_SORT_COLUMN_MAP,
      opsAgentOrganizations.name,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsAgentOrganizations)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsAgentOrganizations)
        .where(where),
    ]);

    return {
      data: rows as Organization[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
