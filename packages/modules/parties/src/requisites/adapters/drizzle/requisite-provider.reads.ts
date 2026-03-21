import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { requisiteProviders } from "./schema";
import type { RequisiteProvider } from "../../application/contracts/dto";
import type { RequisiteProviderReads } from "../../application/ports/requisite-provider.reads";

const PROVIDERS_SORT_COLUMN_MAP = {
  name: requisiteProviders.name,
  kind: requisiteProviders.kind,
  country: requisiteProviders.country,
  createdAt: requisiteProviders.createdAt,
  updatedAt: requisiteProviders.updatedAt,
} as const;

export class DrizzleRequisiteProviderReads implements RequisiteProviderReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<RequisiteProvider | null> {
    const [row] = await this.db
      .select()
      .from(requisiteProviders)
      .where(eq(requisiteProviders.id, id))
      .limit(1);

    return row ?? null;
  }

  async findActiveById(id: string): Promise<RequisiteProvider | null> {
    const [row] = await this.db
      .select()
      .from(requisiteProviders)
      .where(
        and(eq(requisiteProviders.id, id), isNull(requisiteProviders.archivedAt)),
      )
      .limit(1);

    return row ?? null;
  }

  async list(input: {
    limit: number;
    offset: number;
    sortBy?: "name" | "kind" | "country" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
    kind?: string[];
    country?: string[];
    name?: string;
  }): Promise<PaginatedList<RequisiteProvider>> {
    const conditions: SQL[] = [isNull(requisiteProviders.archivedAt)];

    if (input.name) {
      conditions.push(ilike(requisiteProviders.name, `%${input.name}%`));
    }

    if (input.kind?.length) {
      conditions.push(
        inArray(requisiteProviders.kind, input.kind as RequisiteProvider["kind"][]),
      );
    }

    if (input.country?.length) {
      conditions.push(inArray(requisiteProviders.country, input.country));
    }

    const where = and(...conditions);
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByCol = resolveSortValue(
      input.sortBy,
      PROVIDERS_SORT_COLUMN_MAP,
      requisiteProviders.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(requisiteProviders)
        .where(where)
        .orderBy(orderByFn(orderByCol))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(requisiteProviders)
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
