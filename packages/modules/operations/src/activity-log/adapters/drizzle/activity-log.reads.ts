import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { user } from "@bedrock/platform/auth-model/schema";
import type { Queryable } from "@bedrock/platform/persistence";
import type { PaginatedList } from "@bedrock/shared/core/pagination";

import { opsActivityLog } from "../../../infra/drizzle/schema";
import type { ActivityLogEntry } from "../../application/contracts/dto";
import type { ListActivitiesQuery } from "../../application/contracts/queries";
import type { ActivityLogReads } from "../../application/ports/activity-log.reads";

export class DrizzleActivityLogReads implements ActivityLogReads {
  constructor(private readonly db: Queryable) {}

  async list(
    input: ListActivitiesQuery,
  ): Promise<PaginatedList<ActivityLogEntry>> {
    const conditions: SQL[] = [];

    // Non-admins see only their own activities
    if (!input.isAdmin && input.userId) {
      conditions.push(eq(opsActivityLog.userId, input.userId));
    }

    if (input.action) {
      conditions.push(
        eq(opsActivityLog.action, input.action as typeof opsActivityLog.action.enumValues[number]),
      );
    }

    if (input.entityType) {
      conditions.push(
        eq(opsActivityLog.entityType, input.entityType as typeof opsActivityLog.entityType.enumValues[number]),
      );
    }

    if (input.entityId) {
      conditions.push(eq(opsActivityLog.entityId, input.entityId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          id: opsActivityLog.id,
          userId: opsActivityLog.userId,
          action: opsActivityLog.action,
          entityType: opsActivityLog.entityType,
          entityId: opsActivityLog.entityId,
          entityTitle: opsActivityLog.entityTitle,
          source: opsActivityLog.source,
          metadata: opsActivityLog.metadata,
          createdAt: opsActivityLog.createdAt,
          userName: user.name,
        })
        .from(opsActivityLog)
        .leftJoin(user, eq(opsActivityLog.userId, user.id))
        .where(where)
        .orderBy(desc(opsActivityLog.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsActivityLog)
        .where(where),
    ]);

    return {
      data: rows as ActivityLogEntry[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
