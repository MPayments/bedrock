import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsClients } from "../../../infra/drizzle/schema";
import type { Client } from "../../application/contracts/dto";
import type { ListClientsQuery } from "../../application/contracts/queries";
import type { ClientReads } from "../../application/ports/client.reads";

const CLIENT_SORT_COLUMN_MAP = {
  orgName: opsClients.orgName,
  createdAt: opsClients.createdAt,
} as const;

export class DrizzleClientReads implements ClientReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Client | null> {
    const [row] = await this.db
      .select()
      .from(opsClients)
      .where(eq(opsClients.id, id))
      .limit(1);
    return (row as unknown as Client) ?? null;
  }

  async list(input: ListClientsQuery): Promise<PaginatedList<Client>> {
    const conditions: SQL[] = [];

    if (input.orgName) {
      conditions.push(ilike(opsClients.orgName, `%${input.orgName}%`));
    }
    if (input.inn) {
      conditions.push(ilike(opsClients.inn, `%${input.inn}%`));
    }
    if (input.isDeleted !== undefined) {
      conditions.push(eq(opsClients.isDeleted, input.isDeleted));
    } else {
      conditions.push(eq(opsClients.isDeleted, false));
    }
    if (input.subAgentId) {
      conditions.push(eq(opsClients.subAgentId, input.subAgentId));
    }
    if (input.userId) {
      conditions.push(eq(opsClients.userId, input.userId));
    }
    if (input.customerId && input.customerId.length > 0) {
      conditions.push(inArray(opsClients.customerId, input.customerId));
    }
    // Full-text search across orgName, inn, directorName
    if (input.search) {
      const pattern = `%${input.search}%`;
      conditions.push(
        or(
          ilike(opsClients.orgName, pattern),
          ilike(opsClients.inn, pattern),
          ilike(opsClients.directorName, pattern),
        )!,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn =
      resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      CLIENT_SORT_COLUMN_MAP,
      opsClients.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsClients)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsClients)
        .where(where),
    ]);

    return {
      data: rows as unknown as Client[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
