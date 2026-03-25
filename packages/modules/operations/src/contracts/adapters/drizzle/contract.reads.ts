import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsContracts } from "../../../infra/drizzle/schema";
import type { Contract } from "../../application/contracts/dto";
import type { ListContractsQuery } from "../../application/contracts/queries";
import type { ContractReads } from "../../application/ports/contract.reads";

const CONTRACT_SORT_COLUMN_MAP = {
  createdAt: opsContracts.createdAt,
  contractNumber: opsContracts.contractNumber,
} as const;

export class DrizzleContractReads implements ContractReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Contract | null> {
    const [row] = await this.db
      .select()
      .from(opsContracts)
      .where(eq(opsContracts.id, id))
      .limit(1);
    return (row as Contract) ?? null;
  }

  async findByClientId(clientId: number): Promise<Contract | null> {
    const [row] = await this.db
      .select()
      .from(opsContracts)
      .where(eq(opsContracts.clientId, clientId))
      .orderBy(desc(opsContracts.updatedAt), desc(opsContracts.id))
      .limit(1);
    return (row as Contract) ?? null;
  }

  async list(input: ListContractsQuery): Promise<PaginatedList<Contract>> {
    const conditions: SQL[] = [];

    if (input.clientId) {
      conditions.push(eq(opsContracts.clientId, input.clientId));
    }

    if (input.isActive !== undefined) {
      conditions.push(eq(opsContracts.isActive, input.isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      CONTRACT_SORT_COLUMN_MAP,
      opsContracts.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsContracts)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsContracts)
        .where(where),
    ]);

    return {
      data: rows as Contract[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
