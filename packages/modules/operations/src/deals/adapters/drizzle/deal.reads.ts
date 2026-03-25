import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  opsAgentBonus,
  opsAgents,
  opsApplications,
  opsCalculations,
  opsClients,
  opsDealDocuments,
  opsDeals,
} from "../../../infra/drizzle/schema";
import type {
  AgentBonus,
  Deal,
  DealDocument,
  DealWithDetails,
} from "../../application/contracts/dto";
import type { ListDealsQuery } from "../../application/contracts/queries";
import type { DealReads } from "../../application/ports/deal.reads";

const DEAL_SORT_COLUMN_MAP = {
  createdAt: opsDeals.createdAt,
  updatedAt: opsDeals.updatedAt,
} as const;

export class DrizzleDealReads implements DealReads {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Deal | null> {
    const [row] = await this.db
      .select()
      .from(opsDeals)
      .where(eq(opsDeals.id, id))
      .limit(1);
    return (row as unknown as Deal) ?? null;
  }

  async findByIdWithDetails(id: number): Promise<DealWithDetails | null> {
    const [dealRow] = await this.db
      .select()
      .from(opsDeals)
      .where(eq(opsDeals.id, id))
      .limit(1);

    if (!dealRow) return null;

    const deal = dealRow as unknown as Deal;

    // Fetch application
    const [appRow] = await this.db
      .select({
        id: opsApplications.id,
        clientId: opsApplications.clientId,
        agentId: opsApplications.agentId,
        status: opsApplications.status,
        requestedAmount: opsApplications.requestedAmount,
        requestedCurrency: opsApplications.requestedCurrency,
      })
      .from(opsApplications)
      .where(eq(opsApplications.id, deal.applicationId))
      .limit(1);

    // Fetch calculation
    const [calcRow] = await this.db
      .select({
        id: opsCalculations.id,
        originalAmount: opsCalculations.originalAmount,
        currencyCode: opsCalculations.currencyCode,
        baseCurrencyCode: opsCalculations.baseCurrencyCode,
        rate: opsCalculations.rate,
        feePercentage: opsCalculations.feePercentage,
        feeAmount: opsCalculations.feeAmount,
        totalWithExpensesInBase: opsCalculations.totalWithExpensesInBase,
      })
      .from(opsCalculations)
      .where(eq(opsCalculations.id, deal.calculationId))
      .limit(1);

    // Fetch client
    let client: DealWithDetails["client"] = null;
    if (appRow) {
      const [clientRow] = await this.db
        .select({
          id: opsClients.id,
          orgName: opsClients.orgName,
          inn: opsClients.inn,
        })
        .from(opsClients)
        .where(eq(opsClients.id, appRow.clientId))
        .limit(1);
      client = clientRow ?? null;
    }

    // Fetch agent
    let agent: DealWithDetails["agent"] = null;
    if (appRow?.agentId) {
      const [agentRow] = await this.db
        .select({
          id: opsAgents.id,
          name: opsAgents.name,
        })
        .from(opsAgents)
        .where(eq(opsAgents.id, appRow.agentId))
        .limit(1);
      agent = agentRow ?? null;
    }

    // Fetch latest bonus (dedup: take latest by id)
    const latestBonus = await this.getLatestBonusForDeal(deal.id);

    return {
      deal,
      application: appRow!,
      calculation: calcRow ?? null,
      client,
      agent,
      latestBonus,
    };
  }

  async list(input: ListDealsQuery): Promise<PaginatedList<Deal>> {
    const conditions: SQL[] = [];

    if (input.status && input.status.length > 0) {
      conditions.push(
        inArray(
          opsDeals.status,
          input.status as typeof opsDeals.status.enumValues,
        ),
      );
    }

    if (input.agentId) {
      const appIds = await this.db
        .select({ id: opsApplications.id })
        .from(opsApplications)
        .where(eq(opsApplications.agentId, input.agentId));
      const ids = appIds.map((a) => a.id);
      if (ids.length === 0) {
        return { data: [], total: 0, limit: input.limit, offset: input.offset };
      }
      conditions.push(inArray(opsDeals.applicationId, ids));
    }

    if (input.clientId) {
      const appIds = await this.db
        .select({ id: opsApplications.id })
        .from(opsApplications)
        .where(eq(opsApplications.clientId, input.clientId));
      const ids = appIds.map((a) => a.id);
      if (ids.length === 0) {
        return { data: [], total: 0, limit: input.limit, offset: input.offset };
      }
      conditions.push(inArray(opsDeals.applicationId, ids));
    }

    if (input.dateFrom) {
      conditions.push(gte(opsDeals.createdAt, input.dateFrom));
    }
    if (input.dateTo) {
      conditions.push(lte(opsDeals.createdAt, input.dateTo));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn =
      resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      DEAL_SORT_COLUMN_MAP,
      opsDeals.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(opsDeals)
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(opsDeals)
        .where(where),
    ]);

    return {
      data: rows as unknown as Deal[],
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async listDocuments(dealId: number): Promise<DealDocument[]> {
    const rows = await this.db
      .select()
      .from(opsDealDocuments)
      .where(eq(opsDealDocuments.dealId, dealId))
      .orderBy(desc(opsDealDocuments.createdAt));
    return rows as unknown as DealDocument[];
  }

  async getLatestBonusForDeal(dealId: number): Promise<AgentBonus | null> {
    const [row] = await this.db
      .select()
      .from(opsAgentBonus)
      .where(eq(opsAgentBonus.dealId, dealId))
      .orderBy(desc(opsAgentBonus.id))
      .limit(1);
    return (row as unknown as AgentBonus) ?? null;
  }
}
