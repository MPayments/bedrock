import { and, asc, desc, eq, ilike, inArray, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import { dedupeStrings as dedupeIds } from "@bedrock/shared/core/domain";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { schema } from "./schema";
import type { Customer } from "../../application/contracts/dto";
import type { CustomerReads } from "../../application/ports/customer.reads";

const CUSTOMER_SORT_COLUMN_MAP = {
  displayName: schema.customers.displayName,
  externalRef: schema.customers.externalRef,
  createdAt: schema.customers.createdAt,
  updatedAt: schema.customers.updatedAt,
} as const;

export class DrizzleCustomerReads implements CustomerReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, id))
      .limit(1);

    return row ?? null;
  }

  async findByExternalRef(externalRef: string) {
    const [row] = await this.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.externalRef, externalRef))
      .orderBy(desc(schema.customers.createdAt))
      .limit(1);

    return row ?? null;
  }

  async list(input: {
    limit: number;
    offset: number;
    sortBy?: "displayName" | "externalRef" | "createdAt" | "updatedAt";
    sortOrder?: "asc" | "desc";
    displayName?: string;
    externalRef?: string;
  }): Promise<PaginatedList<Customer>> {
    const conditions: SQL[] = [];

    if (input.displayName) {
      conditions.push(
        ilike(schema.customers.displayName, `%${input.displayName}%`),
      );
    }

    if (input.externalRef) {
      conditions.push(
        ilike(schema.customers.externalRef, `%${input.externalRef}%`),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      CUSTOMER_SORT_COLUMN_MAP,
      schema.customers.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(schema.customers)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.customers)
        .where(where),
    ]);

    return {
      data: rows,
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    } satisfies PaginatedList<Customer>;
  }

  async listDisplayNamesById(ids: string[]) {
    const uniqueIds = dedupeIds(ids);
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        id: schema.customers.id,
        displayName: schema.customers.displayName,
      })
      .from(schema.customers)
      .where(inArray(schema.customers.id, uniqueIds));

    return new Map(rows.map((row) => [row.id, row.displayName]));
  }

  async listByIds(ids: string[]) {
    const uniqueIds = dedupeIds(ids);
    if (uniqueIds.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(schema.customers)
      .where(inArray(schema.customers.id, uniqueIds));
  }
}
