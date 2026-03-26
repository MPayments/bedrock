import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  not,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsApplications } from "../../../infra/drizzle/schema";
import type { Application } from "../../application/contracts/dto";
import type { ListApplicationsQuery } from "../../application/contracts/queries";
import type {
  ApplicationsByDayEntry,
  ApplicationsByDayQuery,
  ApplicationsStatistics,
  ApplicationsStatisticsQuery,
} from "../../application/contracts/statistics";
import type { ApplicationReads } from "../../application/ports/application.reads";

const APPLICATION_SORT_COLUMN_MAP = {
  createdAt: opsApplications.createdAt,
  updatedAt: opsApplications.updatedAt,
} as const;

export class DrizzleApplicationReads implements ApplicationReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Application | null> {
    const [row] = await this.db
      .select()
      .from(opsApplications)
      .where(eq(opsApplications.id, id))
      .limit(1);
    return (row as Application) ?? null;
  }

  async list(
    input: ListApplicationsQuery,
  ): Promise<PaginatedList<Application>> {
    const conditions: SQL[] = [];

    if (input.agentId) {
      conditions.push(eq(opsApplications.agentId, input.agentId));
    }
    if (input.clientId) {
      conditions.push(eq(opsApplications.clientId, input.clientId));
    }
    if (input.status && input.status.length > 0) {
      conditions.push(
        inArray(
          opsApplications.status,
          input.status as typeof opsApplications.status.enumValues,
        ),
      );
    }
    if (input.dateFrom) {
      conditions.push(gte(opsApplications.createdAt, input.dateFrom));
    }
    if (input.dateTo) {
      conditions.push(lte(opsApplications.createdAt, input.dateTo));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn =
      resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      APPLICATION_SORT_COLUMN_MAP,
      opsApplications.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsApplications)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsApplications)
        .where(where),
    ]);

    return {
      data: rows as Application[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async countByClientId(clientId: number): Promise<number> {
    const [result] = await this.db
      .select({ total: count() })
      .from(opsApplications)
      .where(eq(opsApplications.clientId, clientId));
    return result?.total ?? 0;
  }

  async listUnassigned(input: {
    limit: number;
    offset: number;
    excludeClientIds?: number[];
  }): Promise<PaginatedList<Application>> {
    const conditions: SQL[] = [
      isNull(opsApplications.agentId),
      eq(opsApplications.status, "forming"),
    ];

    if (input.excludeClientIds && input.excludeClientIds.length > 0) {
      conditions.push(
        not(inArray(opsApplications.clientId, input.excludeClientIds)),
      );
    }

    const where = and(...conditions);

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsApplications)
        .where(where)
        .orderBy(desc(opsApplications.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsApplications)
        .where(where),
    ]);

    return {
      data: rows as Application[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async getStatistics(
    input: ApplicationsStatisticsQuery,
  ): Promise<ApplicationsStatistics> {
    const conditions: SQL[] = [];
    if (input.agentId) {
      conditions.push(eq(opsApplications.agentId, input.agentId));
    }
    if (input.dateFrom) {
      conditions.push(gte(opsApplications.createdAt, input.dateFrom));
    }
    if (input.dateTo) {
      conditions.push(lte(opsApplications.createdAt, input.dateTo));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        status: opsApplications.status,
        count: sql<number>`count(*)::int`,
      })
      .from(opsApplications)
      .where(where)
      .groupBy(opsApplications.status);

    const byStatus: Record<string, number> = {};
    let totalCount = 0;
    for (const row of rows) {
      byStatus[row.status] = row.count;
      totalCount += row.count;
    }

    return { totalCount, byStatus };
  }

  async getByDay(
    input: ApplicationsByDayQuery,
  ): Promise<ApplicationsByDayEntry[]> {
    const conditions: SQL[] = [];
    if (input.agentId) {
      conditions.push(eq(opsApplications.agentId, input.agentId));
    }
    if (input.dateFrom) {
      conditions.push(gte(opsApplications.createdAt, input.dateFrom));
    }
    if (input.dateTo) {
      conditions.push(lte(opsApplications.createdAt, input.dateTo));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        date: sql<string>`to_char(${opsApplications.createdAt}::date, 'YYYY-MM-DD')`,
        status: opsApplications.status,
        count: sql<number>`count(*)::int`,
      })
      .from(opsApplications)
      .where(where)
      .groupBy(
        sql`${opsApplications.createdAt}::date`,
        opsApplications.status,
      )
      .orderBy(sql`${opsApplications.createdAt}::date`);

    const dayMap = new Map<string, ApplicationsByDayEntry>();
    for (const row of rows) {
      const existing = dayMap.get(row.date);
      if (existing) {
        existing.count += row.count;
        existing.byStatus[row.status] = row.count;
      } else {
        dayMap.set(row.date, {
          date: row.date,
          count: row.count,
          byStatus: { [row.status]: row.count },
        });
      }
    }

    return [...dayMap.values()];
  }
}
