import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { toMinorAmountString } from "@bedrock/shared/money";

import type {
  CrmDealByStatusItem,
  CrmDealListItem,
  CrmDealsByDayItem,
  CrmDealsByDayQuery,
  CrmDealsByStatus,
  CrmDealsListProjection,
  CrmDealsListQuery,
  CrmDealsStats,
  CrmDealsStatsQuery,
} from "../contracts";
import { CrmDealsListQuerySchema } from "../contracts";
import type {
  CurrencyDetailsLike,
  CustomerListItemLike,
  DealListRecord,
  DealProjectionsWorkflowDeps,
  UserDetailsLike,
} from "../shared/deps";
import {
  buildCrmDealMoneySummary,
  loadDealMoneyLookups,
} from "../shared/money";
import {
  compareBigInt,
  compareNullableDates,
  compareNullableStrings,
  parseMinorOrZero,
  parseOptionalSet,
  toMap,
  toMinorOrZero,
} from "../shared/utils";

export async function listAllDeals(
  deps: Pick<DealProjectionsWorkflowDeps, "deals">,
  input?: { customerId?: string },
): Promise<DealListRecord[]> {
  const deals: DealListRecord[] = [];
  let offset = 0;
  let total: number;

  do {
    const page = await deps.deals.deals.queries.list({
      customerId: input?.customerId,
      limit: MAX_QUERY_LIST_LIMIT,
      offset,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    deals.push(...page.data);
    total = page.total;
    offset += page.limit;
  } while (offset < total);

  return deals;
}

export async function listCrmDeals(
  deps: Pick<
    DealProjectionsWorkflowDeps,
    "calculations" | "currencies" | "deals" | "iam" | "parties"
  >,
  query: Partial<CrmDealsListQuery> = {},
): Promise<CrmDealsListProjection> {
  const normalizedQuery = CrmDealsListQuerySchema.parse(query);
  const requestedStatuses = parseOptionalSet(normalizedQuery.statuses);
  const requestedCurrencies = parseOptionalSet(normalizedQuery.currencies);
  const listedDeals = await listAllDeals(deps, {
    customerId: normalizedQuery.customerId,
  });

  const customerIds = [
    ...new Set(listedDeals.map((deal) => deal.customerId)),
  ];
  const agentIds = [
    ...new Set(
      listedDeals
        .map((deal) => deal.agentId)
        .filter((agentId): agentId is string => Boolean(agentId)),
    ),
  ];
  const [
    { baseCurrenciesById, calculationsById, currenciesById },
    customers,
    agentEntries,
  ] = await Promise.all([
    loadDealMoneyLookups(listedDeals, deps),
    deps.parties.customers.queries.listByIds(customerIds),
    Promise.all(
      agentIds.map(
        async (agentId): Promise<readonly [string, UserDetailsLike]> =>
          [agentId, await deps.iam.queries.findById(agentId)] as const,
      ),
    ),
  ]);

  const agentsById = toMap(agentEntries);
  const customersById = toMap(
    customers.map(
      (customer): readonly [string, CustomerListItemLike] =>
        [customer.id, customer] as const,
    ),
  );

  const enrichedDeals = listedDeals.map(
    (
      deal,
    ): CrmDealListItem & {
      agentId: string | null;
      amountInBaseMinor: bigint;
      amountMinor: bigint;
      createdAtDate: number;
    } => {
      const customer = customersById.get(deal.customerId) ?? null;
      const calculation = deal.calculationId
        ? (calculationsById.get(deal.calculationId) ?? null)
        : null;
      const sourceCurrency = deal.currencyId
        ? (currenciesById.get(deal.currencyId) ?? null)
        : null;
      const baseCurrency = calculation
        ? (baseCurrenciesById.get(
            calculation.currentSnapshot.baseCurrencyId,
          ) ?? null)
        : null;
      const agent = deal.agentId
        ? (agentsById.get(deal.agentId) ?? null)
        : null;
      const monetary = buildCrmDealMoneySummary({
        deal,
        calculation,
        sourceCurrency,
        baseCurrency,
      });
      const closedAt =
        deal.status === "done" || deal.status === "cancelled"
          ? deal.updatedAt.toISOString()
          : null;
      const comment =
        deal.comment ?? deal.intakeComment ?? deal.reason ?? undefined;

      return {
        agentId: deal.agentId,
        agentName: agent?.name ?? "",
        amount: monetary.amount,
        amountInBase: monetary.amountInBase,
        amountInBaseMinor: monetary.amountInBaseMinor,
        amountMinor: monetary.amountMinor,
        baseCurrencyCode: monetary.baseCurrencyCode,
        client: customer?.name ?? "—",
        clientId: deal.customerId,
        closedAt,
        comment,
        createdAt: deal.createdAt.toISOString(),
        createdAtDate: deal.createdAt.getTime(),
        currency: monetary.currencyCode,
        feePercentage: monetary.feePercentage,
        id: deal.id,
        status: deal.status,
        updatedAt: deal.updatedAt.toISOString(),
      };
    },
  );

  const filteredDeals = enrichedDeals.filter((deal) => {
    if (requestedStatuses && !requestedStatuses.has(deal.status)) {
      return false;
    }
    if (requestedCurrencies && !requestedCurrencies.has(deal.currency)) {
      return false;
    }
    if (normalizedQuery.agentId && deal.agentId !== normalizedQuery.agentId) {
      return false;
    }
    if (
      normalizedQuery.dateFrom &&
      deal.createdAtDate < normalizedQuery.dateFrom.getTime()
    ) {
      return false;
    }
    if (
      normalizedQuery.dateTo &&
      deal.createdAtDate > normalizedQuery.dateTo.getTime()
    ) {
      return false;
    }
    if (
      normalizedQuery.qClient &&
      !deal.client
        .toLowerCase()
        .includes(normalizedQuery.qClient.toLowerCase())
    ) {
      return false;
    }
    if (
      normalizedQuery.qComment &&
      !(deal.comment ?? "")
        .toLowerCase()
        .includes(normalizedQuery.qComment.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  filteredDeals.sort((left, right) => {
    const comparison = (() => {
      switch (normalizedQuery.sortBy) {
        case "id":
          return left.id.localeCompare(right.id);
        case "client":
          return compareNullableStrings(left.client, right.client);
        case "amount":
          return compareBigInt(left.amountMinor, right.amountMinor);
        case "amountInBase":
          return compareBigInt(
            left.amountInBaseMinor,
            right.amountInBaseMinor,
          );
        case "closedAt":
          return compareNullableDates(left.closedAt, right.closedAt);
        case "agentName":
          return compareNullableStrings(left.agentName, right.agentName);
        case "createdAt":
        default:
          return left.createdAtDate - right.createdAtDate;
      }
    })();

    return normalizedQuery.sortOrder === "asc" ? comparison : -comparison;
  });

  const pagedDeals = filteredDeals
    .slice(
      normalizedQuery.offset,
      normalizedQuery.offset + normalizedQuery.limit,
    )
    .map(
      ({
        agentId: _agentId,
        amountInBaseMinor: _amountInBaseMinor,
        amountMinor: _amountMinor,
        createdAtDate: _createdAtDate,
        ...deal
      }) => deal,
    );

  return {
    data: pagedDeals,
    limit: normalizedQuery.limit,
    offset: normalizedQuery.offset,
    total: filteredDeals.length,
  };
}

export async function getCrmDealsStats(
  deps: Pick<DealProjectionsWorkflowDeps, "currencies" | "deals">,
  input: CrmDealsStatsQuery,
): Promise<CrmDealsStats> {
  const listedDeals = await listAllDeals(deps);
  const currenciesById = toMap(
    await Promise.all(
      [
        ...new Set(
          listedDeals
            .map((deal) => deal.currencyId)
            .filter((currencyId): currencyId is string =>
              Boolean(currencyId),
            ),
        ),
      ].map(
        async (currencyId): Promise<readonly [string, CurrencyDetailsLike]> =>
          [currencyId, await deps.currencies.findById(currencyId)] as const,
      ),
    ),
  );
  const from = new Date(`${input.dateFrom}T00:00:00Z`);
  const to = new Date(`${input.dateTo}T23:59:59.999Z`);
  let totalCount = 0;
  let totalAmount = 0n;
  const byStatus: Record<string, number> = {};

  for (const deal of listedDeals) {
    if (deal.createdAt < from || deal.createdAt > to) {
      continue;
    }

    totalCount += 1;
    byStatus[deal.status] = (byStatus[deal.status] ?? 0) + 1;

    const currencyCode =
      (deal.currencyId
        ? currenciesById.get(deal.currencyId)?.code
        : undefined) ?? "RUB";
    totalAmount += BigInt(
      toMinorAmountString(deal.amount ?? "0", currencyCode),
    );
  }

  return {
    byStatus,
    totalAmount: totalAmount.toString(),
    totalCount,
  };
}

export async function listCrmDealsByStatus(
  deps: Pick<
    DealProjectionsWorkflowDeps,
    "calculations" | "currencies" | "deals" | "parties"
  >,
): Promise<CrmDealsByStatus> {
  const PENDING_STATUSES = ["awaiting_funds"] as const;
  const IN_PROGRESS_STATUSES = [
    "draft",
    "submitted",
    "preparing_documents",
    "awaiting_payment",
  ] as const;
  const DONE_STATUSES = ["closing_documents", "done"] as const;

  const listedDeals = await listAllDeals(deps);
  const customerIds = [
    ...new Set(listedDeals.map((deal) => deal.customerId)),
  ];

  const [
    { baseCurrenciesById, calculationsById, currenciesById },
    customers,
  ] = await Promise.all([
    loadDealMoneyLookups(listedDeals, deps),
    deps.parties.customers.queries.listByIds(customerIds),
  ]);

  const customersById = toMap(
    customers.map(
      (customer): readonly [string, CustomerListItemLike] =>
        [customer.id, customer] as const,
    ),
  );

  function toDealItem(deal: DealListRecord): CrmDealByStatusItem {
    const comment =
      deal.comment ?? deal.intakeComment ?? deal.reason ?? undefined;
    const calculation = deal.calculationId
      ? (calculationsById.get(deal.calculationId) ?? null)
      : null;
    const sourceCurrency = deal.currencyId
      ? (currenciesById.get(deal.currencyId) ?? null)
      : null;
    const baseCurrency = calculation
      ? (baseCurrenciesById.get(calculation.currentSnapshot.baseCurrencyId) ??
        null)
      : null;
    const monetary = buildCrmDealMoneySummary({
      deal,
      calculation,
      sourceCurrency,
      baseCurrency,
    });

    return {
      amount: monetary.amount,
      amountInBase: monetary.amountInBase,
      baseCurrencyCode: monetary.baseCurrencyCode,
      client: customersById.get(deal.customerId)?.name ?? "—",
      createdAt: deal.createdAt.toISOString(),
      currency: monetary.currencyCode,
      id: deal.id,
      status: deal.status,
      ...(comment ? { comment } : {}),
    };
  }

  return {
    done: listedDeals
      .filter((deal) =>
        (DONE_STATUSES as readonly string[]).includes(deal.status),
      )
      .map(toDealItem),
    inProgress: listedDeals
      .filter((deal) =>
        (IN_PROGRESS_STATUSES as readonly string[]).includes(deal.status),
      )
      .map(toDealItem),
    pending: listedDeals
      .filter((deal) =>
        (PENDING_STATUSES as readonly string[]).includes(deal.status),
      )
      .map(toDealItem),
  };
}

export async function listCrmDealsByDay(
  deps: Pick<DealProjectionsWorkflowDeps, "currencies" | "deals">,
  query: CrmDealsByDayQuery = {},
): Promise<CrmDealsByDayItem[]> {
  const listedDeals = await listAllDeals(deps, { customerId: query.customerId });
  const requestedStatuses = parseOptionalSet(query.statuses);
  const requestedCurrencies = parseOptionalSet(query.currencies);
  const currenciesById = toMap(
    await Promise.all(
      [
        ...new Set(
          listedDeals
            .map((deal) => deal.currencyId)
            .filter((currencyId): currencyId is string =>
              Boolean(currencyId),
            ),
        ),
      ].map(
        async (currencyId): Promise<readonly [string, CurrencyDetailsLike]> =>
          [currencyId, await deps.currencies.findById(currencyId)] as const,
      ),
    ),
  );
  const precisionByCode = new Map(
    Array.from(currenciesById.values())
      .filter((currency): currency is NonNullable<typeof currency> =>
        Boolean(currency),
      )
      .map((currency) => [currency.code, currency.precision] as const),
  );

  const dayMap = new Map<
    string,
    {
      closedCount: number;
      count: number;
      date: string;
      totalsByCurrency: Map<string, bigint>;
      closedTotalsByCurrency: Map<string, bigint>;
    }
  >();

  for (const deal of listedDeals) {
    if (query.dateFrom && deal.createdAt < new Date(query.dateFrom)) {
      continue;
    }
    if (query.dateTo && deal.createdAt > new Date(query.dateTo)) {
      continue;
    }
    if (query.agentId && deal.agentId !== query.agentId) {
      continue;
    }
    if (requestedStatuses && !requestedStatuses.has(deal.status)) {
      continue;
    }

    const currencyCode =
      (deal.currencyId
        ? currenciesById.get(deal.currencyId)?.code
        : undefined) ?? "RUB";

    if (requestedCurrencies && !requestedCurrencies.has(currencyCode)) {
      continue;
    }

    const date = deal.createdAt.toISOString().slice(0, 10);
    const totalMinor = toMinorOrZero(deal.amount, currencyCode);

    if (!dayMap.has(date)) {
      dayMap.set(date, {
        closedCount: 0,
        count: 0,
        date,
        closedTotalsByCurrency: new Map<string, bigint>(),
        totalsByCurrency: new Map<string, bigint>(),
      });
    }

    const day = dayMap.get(date)!;
    day.count += 1;
    day.totalsByCurrency.set(
      currencyCode,
      (day.totalsByCurrency.get(currencyCode) ?? 0n) + totalMinor,
    );

    if (deal.status === "done") {
      day.closedCount += 1;
      day.closedTotalsByCurrency.set(
        currencyCode,
        (day.closedTotalsByCurrency.get(currencyCode) ?? 0n) + totalMinor,
      );
    }
  }

  return Array.from(dayMap.values()).map((day) => {
    const totalsByCurrency = Array.from(day.totalsByCurrency.entries()).map(
      ([currencyCode, amountMinor]) => {
        return [
          currencyCode,
          parseMinorOrZero(
            amountMinor,
            precisionByCode.get(currencyCode) ?? 2,
          ),
        ] as const;
      },
    );
    const totalsObject = Object.fromEntries(totalsByCurrency);
    const reportCurrencyCode = query.reportCurrencyCode?.trim().toUpperCase();
    const amount = reportCurrencyCode
      ? ((totalsObject[reportCurrencyCode] as number | undefined) ?? 0)
      : totalsByCurrency.length === 1
        ? (totalsByCurrency[0]?.[1] ?? 0)
        : 0;
    const closedAmount = reportCurrencyCode
      ? parseMinorOrZero(
          day.closedTotalsByCurrency.get(reportCurrencyCode) ?? 0n,
          precisionByCode.get(reportCurrencyCode) ?? 2,
        )
      : day.closedTotalsByCurrency.size === 1
        ? parseMinorOrZero(
            Array.from(day.closedTotalsByCurrency.values())[0] ?? 0n,
            precisionByCode.get(
              Array.from(day.closedTotalsByCurrency.keys())[0] ?? "",
            ) ?? 2,
          )
        : 0;

    return {
      amount,
      closedAmount,
      closedCount: day.closedCount,
      count: day.count,
      date: day.date,
      ...totalsObject,
    };
  });
}
