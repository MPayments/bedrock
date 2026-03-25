import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsCalculations } from "../../../infra/drizzle/schema";
import type { Calculation } from "../../application/contracts/dto";
import type { ListCalculationsQuery } from "../../application/contracts/queries";
import type { CalculationReads } from "../../application/ports/calculation.reads";

export class DrizzleCalculationReads implements CalculationReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Calculation | null> {
    const [row] = await this.db
      .select()
      .from(opsCalculations)
      .where(eq(opsCalculations.id, id))
      .limit(1);
    return (row as unknown as Calculation) ?? null;
  }

  async findByApplicationId(applicationId: number): Promise<Calculation[]> {
    const rows = await this.db
      .select()
      .from(opsCalculations)
      .where(eq(opsCalculations.applicationId, applicationId))
      .orderBy(desc(opsCalculations.id));
    return rows as unknown as Calculation[];
  }

  async findLatestByApplicationId(
    applicationId: number,
  ): Promise<Calculation | null> {
    const [row] = await this.db
      .select()
      .from(opsCalculations)
      .where(eq(opsCalculations.applicationId, applicationId))
      .orderBy(desc(opsCalculations.id))
      .limit(1);
    return (row as unknown as Calculation) ?? null;
  }

  async list(
    input: ListCalculationsQuery,
  ): Promise<PaginatedList<Calculation>> {
    const conditions: SQL[] = [];

    if (input.applicationId) {
      conditions.push(
        eq(opsCalculations.applicationId, input.applicationId),
      );
    }
    if (input.status) {
      conditions.push(eq(opsCalculations.status, input.status));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn =
      resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsCalculations)
        .where(where)
        .orderBy(orderByFn(opsCalculations.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsCalculations)
        .where(where),
    ]);

    return {
      data: rows as unknown as Calculation[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
