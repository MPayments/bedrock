import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { opsAgentOrganizationBankDetails } from "../../../infra/drizzle/schema/agents";
import type { BankDetails } from "../../application/contracts/bank-details-dto";
import type { ListBankDetailsQuery } from "../../application/contracts/bank-details-queries";
import type { BankDetailsReads } from "../../application/ports/bank-details.reads";

const BANK_SORT_COLUMN_MAP = {
  name: opsAgentOrganizationBankDetails.name,
  bankName: opsAgentOrganizationBankDetails.bankName,
  createdAt: opsAgentOrganizationBankDetails.createdAt,
} as const;

export class DrizzleBankDetailsReads implements BankDetailsReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<BankDetails | null> {
    const [row] = await this.db
      .select()
      .from(opsAgentOrganizationBankDetails)
      .where(eq(opsAgentOrganizationBankDetails.id, id))
      .limit(1);
    return (row as BankDetails) ?? null;
  }

  async listByOrganizationId(organizationId: number): Promise<BankDetails[]> {
    const rows = await this.db
      .select()
      .from(opsAgentOrganizationBankDetails)
      .where(
        and(
          eq(opsAgentOrganizationBankDetails.organizationId, organizationId),
          eq(opsAgentOrganizationBankDetails.isActive, true),
        ),
      );
    return rows as BankDetails[];
  }

  async list(
    input: ListBankDetailsQuery,
  ): Promise<PaginatedList<BankDetails>> {
    const conditions: SQL[] = [];

    if (input.organizationId) {
      conditions.push(
        eq(
          opsAgentOrganizationBankDetails.organizationId,
          input.organizationId,
        ),
      );
    }
    if (input.isActive !== undefined) {
      conditions.push(
        eq(opsAgentOrganizationBankDetails.isActive, input.isActive),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      BANK_SORT_COLUMN_MAP,
      opsAgentOrganizationBankDetails.name,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsAgentOrganizationBankDetails)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsAgentOrganizationBankDetails)
        .where(where),
    ]);

    return {
      data: rows as BankDetails[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }
}
