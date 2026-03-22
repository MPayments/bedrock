import { and, eq, inArray } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "../../../schema";
import type { PeriodReads } from "../../application/ports/period.reads";

export class DrizzlePeriodReads implements PeriodReads {
  constructor(private readonly db: Queryable) {}

  async findClosedPeriodLock(input: {
    organizationId: string;
    periodStart: Date;
  }) {
    const [lock] = await this.db
      .select({
        id: schema.accountingPeriodLocks.id,
      })
      .from(schema.accountingPeriodLocks)
      .where(
        and(
          eq(schema.accountingPeriodLocks.organizationId, input.organizationId),
          eq(schema.accountingPeriodLocks.periodStart, input.periodStart),
          eq(schema.accountingPeriodLocks.state, "closed"),
        ),
      )
      .limit(1);

    return lock ?? null;
  }

  async listClosedOrganizationIdsForPeriod(input: {
    organizationIds: string[];
    periodStart: Date;
  }) {
    const uniqueOrganizationIds = Array.from(
      new Set(input.organizationIds.filter(Boolean)),
    );
    if (uniqueOrganizationIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        organizationId: schema.accountingPeriodLocks.organizationId,
      })
      .from(schema.accountingPeriodLocks)
      .where(
        and(
          inArray(
            schema.accountingPeriodLocks.organizationId,
            uniqueOrganizationIds,
          ),
          eq(schema.accountingPeriodLocks.periodStart, input.periodStart),
          eq(schema.accountingPeriodLocks.state, "closed"),
        ),
      );

    return rows.map((row) => row.organizationId);
  }
}
