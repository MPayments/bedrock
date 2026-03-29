import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { user } from "@bedrock/iam/schema";

import {
  opsAgentBonus,
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
  DealListRow,
  DealWithDetails,
} from "../../application/contracts/dto";
import type { ListDealsQuery } from "../../application/contracts/queries";
import type {
  DealsByDayEntry,
  DealsByDayQuery,
  DealsByStatusEntry,
  DealsStatistics,
  DealsStatisticsQuery,
} from "../../application/contracts/statistics";
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
        feeAmountInBase: opsCalculations.feeAmountInBase,
        additionalExpenses: opsCalculations.additionalExpenses,
        additionalExpensesCurrencyCode: opsCalculations.additionalExpensesCurrencyCode,
        additionalExpensesInBase: opsCalculations.additionalExpensesInBase,
        totalInBase: opsCalculations.totalInBase,
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
          id: user.id,
          name: user.name,
        })
        .from(user)
        .where(eq(user.id, appRow.agentId))
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

  async list(input: ListDealsQuery): Promise<PaginatedList<DealListRow>> {
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
      conditions.push(eq(opsApplications.agentId, input.agentId));
    }

    if (input.clientId) {
      conditions.push(eq(opsApplications.clientId, input.clientId));
    }

    if (input.dateFrom) {
      conditions.push(gte(sql`${opsDeals.createdAt}::date`, input.dateFrom));
    }
    if (input.dateTo) {
      conditions.push(lte(sql`${opsDeals.createdAt}::date`, input.dateTo));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn =
      resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      DEAL_SORT_COLUMN_MAP,
      opsDeals.createdAt,
    );

    const selectFields = {
      id: opsDeals.id,
      createdAt: opsDeals.createdAt,
      updatedAt: opsDeals.updatedAt,
      closedAt: opsDeals.closedAt,
      status: opsDeals.status,
      comment: opsDeals.comment,
      client: opsClients.orgName,
      clientId: opsApplications.clientId,
      amount: opsCalculations.originalAmount,
      currency: opsCalculations.currencyCode,
      amountInBase: opsCalculations.totalWithExpensesInBase,
      baseCurrencyCode: opsCalculations.baseCurrencyCode,
      agentName: user.name,
      feePercentage: opsCalculations.feePercentage,
    };

    const baseQuery = this.db
      .select(selectFields)
      .from(opsDeals)
      .innerJoin(
        opsApplications,
        eq(opsDeals.applicationId, opsApplications.id),
      )
      .innerJoin(
        opsCalculations,
        eq(opsDeals.calculationId, opsCalculations.id),
      )
      .innerJoin(opsClients, eq(opsApplications.clientId, opsClients.id))
      .leftJoin(user, eq(opsApplications.agentId, user.id))
      .where(where);

    const countQuery = this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(opsDeals)
      .innerJoin(
        opsApplications,
        eq(opsDeals.applicationId, opsApplications.id),
      )
      .innerJoin(
        opsCalculations,
        eq(opsDeals.calculationId, opsCalculations.id),
      )
      .innerJoin(opsClients, eq(opsApplications.clientId, opsClients.id))
      .leftJoin(user, eq(opsApplications.agentId, user.id))
      .where(where);

    const [rows, countRows] = await Promise.all([
      baseQuery
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset),
      countQuery,
    ]);

    const data: DealListRow[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt as string,
      updatedAt: r.updatedAt as string,
      closedAt: (r.closedAt as string) ?? null,
      client: r.client ?? "",
      clientId: r.clientId,
      amount: Number(r.amount) || 0,
      currency: r.currency ?? "RUB",
      amountInBase: Number(r.amountInBase) || 0,
      baseCurrencyCode: r.baseCurrencyCode ?? "RUB",
      status: r.status,
      agentName: r.agentName ?? "",
      comment: (r.comment as string) ?? null,
      feePercentage: Number(r.feePercentage) || 0,
    }));

    return {
      data,
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async listGroupedByStatus() {
    const selectFields = {
      id: opsDeals.id,
      createdAt: opsDeals.createdAt,
      updatedAt: opsDeals.updatedAt,
      closedAt: opsDeals.closedAt,
      status: opsDeals.status,
      comment: opsDeals.comment,
      client: opsClients.orgName,
      clientId: opsApplications.clientId,
      amount: opsCalculations.originalAmount,
      currency: opsCalculations.currencyCode,
      amountInBase: opsCalculations.totalWithExpensesInBase,
      baseCurrencyCode: opsCalculations.baseCurrencyCode,
      agentName: user.name,
      feePercentage: opsCalculations.feePercentage,
    };

    const fetchGroup = async (statuses: string[]): Promise<DealListRow[]> => {
      const rows = await this.db
        .select(selectFields)
        .from(opsDeals)
        .innerJoin(
          opsApplications,
          eq(opsDeals.applicationId, opsApplications.id),
        )
        .innerJoin(
          opsCalculations,
          eq(opsDeals.calculationId, opsCalculations.id),
        )
        .innerJoin(opsClients, eq(opsApplications.clientId, opsClients.id))
        .leftJoin(user, eq(opsApplications.agentId, user.id))
        .where(inArray(opsDeals.status, statuses as typeof opsDeals.status.enumValues))
        .orderBy(desc(opsDeals.createdAt))
        .limit(20);

      return rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        closedAt: (r.closedAt as string) ?? null,
        client: r.client ?? "",
        clientId: r.clientId,
        amount: Number(r.amount) || 0,
        currency: r.currency ?? "RUB",
        amountInBase: Number(r.amountInBase) || 0,
        baseCurrencyCode: r.baseCurrencyCode ?? "RUB",
        status: r.status,
        agentName: r.agentName ?? "",
        comment: (r.comment as string) ?? null,
        feePercentage: Number(r.feePercentage) || 0,
      }));
    };

    const [pending, inProgress, done] = await Promise.all([
      fetchGroup(["preparing_documents", "awaiting_funds"]),
      fetchGroup(["awaiting_payment", "closing_documents"]),
      fetchGroup(["done"]),
    ]);

    return { pending, inProgress, done };
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

  async getStatistics(input: DealsStatisticsQuery): Promise<DealsStatistics> {
    const conditions: SQL[] = [];
    if (input.agentId) {
      const appIds = await this.db
        .select({ id: opsApplications.id })
        .from(opsApplications)
        .where(eq(opsApplications.agentId, input.agentId));
      const ids = appIds.map((a) => a.id);
      if (ids.length === 0) {
        return { totalCount: 0, byStatus: {}, totalAmount: "0" };
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
        return { totalCount: 0, byStatus: {}, totalAmount: "0" };
      }
      conditions.push(inArray(opsDeals.applicationId, ids));
    }
    if (input.dateFrom) {
      conditions.push(gte(sql`${opsDeals.createdAt}::date`, input.dateFrom));
    }
    if (input.dateTo) {
      conditions.push(lte(sql`${opsDeals.createdAt}::date`, input.dateTo));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        status: opsDeals.status,
        count: sql<number>`count(*)::int`,
      })
      .from(opsDeals)
      .where(where)
      .groupBy(opsDeals.status);

    const byStatus: Record<string, number> = {};
    let totalCount = 0;
    for (const row of rows) {
      byStatus[row.status] = row.count;
      totalCount += row.count;
    }

    const [amountRow] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${opsCalculations.totalWithExpensesInBase}::numeric), 0)::text`,
      })
      .from(opsDeals)
      .innerJoin(opsCalculations, eq(opsDeals.calculationId, opsCalculations.id))
      .where(where);

    return { totalCount, byStatus, totalAmount: amountRow?.total ?? "0" };
  }

  async getByDay(input: DealsByDayQuery): Promise<DealsByDayEntry[]> {
    const conditions: SQL[] = [];
    if (input.agentId) {
      const appIds = await this.db
        .select({ id: opsApplications.id })
        .from(opsApplications)
        .where(eq(opsApplications.agentId, input.agentId));
      const ids = appIds.map((a) => a.id);
      if (ids.length === 0) return [];
      conditions.push(inArray(opsDeals.applicationId, ids));
    }
    if (input.clientId) {
      const appIds = await this.db
        .select({ id: opsApplications.id })
        .from(opsApplications)
        .where(eq(opsApplications.clientId, input.clientId));
      const ids = appIds.map((a) => a.id);
      if (ids.length === 0) return [];
      conditions.push(inArray(opsDeals.applicationId, ids));
    }
    if (input.dateFrom) {
      conditions.push(gte(sql`${opsDeals.createdAt}::date`, input.dateFrom));
    }
    if (input.dateTo) {
      conditions.push(lte(sql`${opsDeals.createdAt}::date`, input.dateTo));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await this.db
      .select({
        date: sql<string>`to_char(${opsDeals.createdAt}::date, 'YYYY-MM-DD')`,
        status: opsDeals.status,
        count: sql<number>`count(*)::int`,
      })
      .from(opsDeals)
      .where(where)
      .groupBy(sql`${opsDeals.createdAt}::date`, opsDeals.status)
      .orderBy(sql`${opsDeals.createdAt}::date`);

    const dayMap = new Map<string, DealsByDayEntry>();
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

  async getByStatus(): Promise<DealsByStatusEntry[]> {
    const rows = await this.db
      .select({
        status: opsDeals.status,
        count: sql<number>`count(*)::int`,
      })
      .from(opsDeals)
      .groupBy(opsDeals.status);

    return rows.map((row) => ({
      status: row.status,
      count: row.count,
    }));
  }
}
