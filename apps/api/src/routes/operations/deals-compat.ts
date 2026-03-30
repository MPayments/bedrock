import { z } from "@hono/zod-openapi";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { minorToDecimalString } from "@bedrock/calculations";
import { currencies } from "@bedrock/currencies/schema";
import {
  CreateDealInputSchema,
  TransitionDealStatusInputSchema,
  UpdateDealIntakeInputSchema,
} from "@bedrock/deals/contracts";
import { user } from "@bedrock/iam/schema";
import {
  opsClients,
  opsDealDocuments,
  opsDeals,
} from "@bedrock/operations/schema";
import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";
import { NotFoundError } from "@bedrock/shared/core/errors";

import type { AppContext } from "../../context";
import { db } from "../../db/client";
import {
  getOrganizationBankRequisiteOrThrow,
  serializeOrganizationRequisiteForDocuments,
} from "../organization-requisites";
import {
  findCompatibilityCalculationById,
  listCompatibilityCalculationsByDealId,
} from "./calculations-compat";
import { resolveEffectiveCompatibilityContractByClientId } from "./contracts-compat";

import { calculations, calculationSnapshots } from "@bedrock/calculations/schema";
import {
  dealParticipants,
  deals,
} from "@bedrock/deals/schema";

const COMPATIBILITY_DEAL_STATUS_VALUES = [
  "draft",
  "submitted",
  "rejected",
  "preparing_documents",
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
  "done",
  "cancelled",
] as const;

export const CompatibilityDealStatusSchema = z.enum(
  COMPATIBILITY_DEAL_STATUS_VALUES,
);

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const CompatibilityDealSchema = z.object({
  id: z.string().uuid(),
  calculationId: z.string().uuid().nullable(),
  counterpartyId: z.string().uuid().nullable(),
  organizationRequisiteId: z.string().uuid().nullable(),
  status: CompatibilityDealStatusSchema,
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  companyName: z.string().nullable(),
  companyNameI18n: LocalizedTextSchema,
  bankName: z.string().nullable(),
  bankNameI18n: LocalizedTextSchema,
  account: z.string().nullable(),
  swiftCode: z.string().nullable(),
  contractDate: z.string().nullable(),
  contractNumber: z.string().nullable(),
  costPrice: z.string().nullable(),
  closedAt: z.string().nullable(),
  comment: z.string().nullable(),
  agentId: z.string().nullable(),
  reason: z.string().nullable(),
  intakeComment: z.string().nullable(),
  requestedAmount: z.string().nullable(),
  requestedCurrencyId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CompatibilityDealDocumentSchema = z.object({
  id: z.number().int(),
  dealId: z.string().uuid(),
  fileName: z.string(),
  fileSize: z.number().int(),
  mimeType: z.string(),
  s3Key: z.string(),
  uploadedBy: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CompatibilityDealListRowSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
  client: z.string(),
  clientId: z.number().int(),
  counterpartyId: z.string().uuid().nullable(),
  amount: z.number(),
  currency: z.string(),
  amountInBase: z.number(),
  baseCurrencyCode: z.string(),
  status: CompatibilityDealStatusSchema,
  agentName: z.string(),
  comment: z.string().nullable(),
  feePercentage: z.number(),
});

export const PaginatedCompatibilityDealListRowsSchema =
  createPaginatedListSchema(CompatibilityDealListRowSchema);

export const CompatibilityDealsListQuerySchema = z.object({
  sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(50000).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  statuses: z.string().optional(),
  agentId: z.string().optional(),
  clientId: z.coerce.number().int().optional(),
  counterpartyId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  qClient: z.string().optional(),
  qComment: z.string().optional(),
  currencies: z.string().optional(),
  reportCurrencyCode: z.string().optional(),
});

export const CompatibilityDealsStatisticsQuerySchema =
  CompatibilityDealsListQuerySchema.omit({
    limit: true,
    offset: true,
    sortBy: true,
    sortOrder: true,
  });

export const CompatibilityDealsStatisticsSchema = z.object({
  totalCount: z.number(),
  byStatus: z.record(z.string(), z.number()),
  totalAmount: z.string(),
  totalAmountInBase: z.number(),
  activeCount: z.number(),
  doneCount: z.number(),
});

export const CompatibilityDealsByDayQuerySchema =
  CompatibilityDealsStatisticsQuerySchema;

export const CompatibilityDealsByDayRowSchema = z.object({
  date: z.string(),
  amount: z.number(),
  count: z.number(),
  closedAmount: z.number(),
  closedCount: z.number(),
  cumulativeAmount: z.number(),
  cumulativeCount: z.number(),
  USD: z.number().optional(),
  EUR: z.number().optional(),
  CNY: z.number().optional(),
  RUB: z.number().optional(),
});

export const CompatibilityDealsByDaySchema = z.object({
  data: z.array(CompatibilityDealsByDayRowSchema),
});

export const CompatibilityDealsByStatusSchema = z.object({
  pending: z.array(CompatibilityDealListRowSchema),
  inProgress: z.array(CompatibilityDealListRowSchema),
  done: z.array(CompatibilityDealListRowSchema),
});

export const CompatibilityUpdateDealDetailsInputSchema = z.object({
  counterpartyId: z.string().uuid().nullable().optional(),
  organizationRequisiteId: z.string().uuid().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  companyNameI18n: LocalizedTextSchema,
  bankName: z.string().nullable().optional(),
  bankNameI18n: LocalizedTextSchema,
  account: z.string().nullable().optional(),
  swiftCode: z.string().nullable().optional(),
  contractDate: z.string().nullable().optional(),
  contractNumber: z.string().nullable().optional(),
  costPrice: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

type CompatibilityDealListRow = z.infer<typeof CompatibilityDealListRowSchema>;
type CompatibilityDealsListQuery = z.infer<typeof CompatibilityDealsListQuerySchema>;
type CompatibilityDealsStatisticsQuery = z.infer<
  typeof CompatibilityDealsStatisticsQuerySchema
>;
type CompatibilityUpdateDealDetailsInput = z.infer<
  typeof CompatibilityUpdateDealDetailsInputSchema
>;

type DealListQueryRow = {
  agentId: string | null;
  agentName: string | null;
  baseCurrencyCode: string | null;
  baseCurrencyPrecision: number | null;
  calcCurrencyCode: string | null;
  calcCurrencyPrecision: number | null;
  closedAt: string | null;
  comment: string | null;
  counterpartyId: string | null;
  createdAt: Date;
  dealId: string;
  feeBps: bigint | null;
  orgName: string | null;
  opsClientId: number | null;
  requestedAmountMinor: bigint | null;
  requestedCurrencyCode: string | null;
  requestedCurrencyPrecision: number | null;
  status: (typeof COMPATIBILITY_DEAL_STATUS_VALUES)[number];
  totalWithExpensesInBaseMinor: bigint | null;
  updatedAt: Date;
  originalAmountMinor: bigint | null;
};

function parseCsv(value?: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeDateInput(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapDealListRow(row: DealListQueryRow): CompatibilityDealListRow {
  const amount = row.originalAmountMinor != null && row.calcCurrencyPrecision != null
    ? Number(
        minorToDecimalString(row.originalAmountMinor, row.calcCurrencyPrecision),
      )
    : row.requestedAmountMinor != null && row.requestedCurrencyPrecision != null
      ? Number(
          minorToDecimalString(
            row.requestedAmountMinor,
            row.requestedCurrencyPrecision,
          ),
        )
      : 0;
  const amountInBase =
    row.totalWithExpensesInBaseMinor != null && row.baseCurrencyPrecision != null
      ? Number(
          minorToDecimalString(
            row.totalWithExpensesInBaseMinor,
            row.baseCurrencyPrecision,
          ),
        )
      : row.requestedAmountMinor != null && row.requestedCurrencyCode === "RUB"
        ? Number(
            minorToDecimalString(
              row.requestedAmountMinor,
              row.requestedCurrencyPrecision ?? 2,
            ),
          )
        : 0;

  return {
    id: row.dealId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt,
    client: row.orgName ?? "—",
    clientId: row.opsClientId ?? 0,
    counterpartyId: row.counterpartyId,
    amount,
    currency: row.calcCurrencyCode ?? row.requestedCurrencyCode ?? "RUB",
    amountInBase,
    baseCurrencyCode: row.baseCurrencyCode ?? row.requestedCurrencyCode ?? "RUB",
    status: row.status,
    agentName: row.agentName ?? "",
    comment: row.comment,
    feePercentage:
      row.feeBps != null
        ? Number(minorToDecimalString(row.feeBps, 2))
        : 0,
  };
}

function buildDealListConditions(input: CompatibilityDealsListQuery): SQL[] {
  const conditions: SQL[] = [];
  const statuses = parseCsv(input.statuses);
  const currenciesFilter = parseCsv(input.currencies).map((value) =>
    value.toUpperCase(),
  );
  const dateFrom = normalizeDateInput(input.dateFrom);
  const dateTo = normalizeDateInput(input.dateTo);

  const normalizedStatuses = statuses.filter(
    (status): status is (typeof COMPATIBILITY_DEAL_STATUS_VALUES)[number] =>
      COMPATIBILITY_DEAL_STATUS_VALUES.includes(
        status as (typeof COMPATIBILITY_DEAL_STATUS_VALUES)[number],
      ),
  );

  if (normalizedStatuses.length > 0) {
    conditions.push(
      inArray(deals.status, normalizedStatuses),
    );
  }

  if (input.agentId) {
    conditions.push(eq(deals.agentId, input.agentId));
  }

  if (input.clientId !== undefined) {
    conditions.push(eq(opsClients.id, input.clientId));
  }

  if (input.counterpartyId) {
    conditions.push(
      or(
        eq(opsDeals.counterpartyId, input.counterpartyId),
        eq(counterpartyParticipant.counterpartyId, input.counterpartyId),
      )!,
    );
  }

  if (dateFrom) {
    conditions.push(gte(deals.createdAt, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(deals.createdAt, dateTo));
  }

  if (input.qClient) {
    conditions.push(ilike(opsClients.orgName, `%${input.qClient.trim()}%`));
  }

  if (input.qComment) {
    conditions.push(
      ilike(
        sql<string>`coalesce(${opsDeals.comment}, ${deals.comment}, '')`,
        `%${input.qComment.trim()}%`,
      ),
    );
  }

  if (currenciesFilter.length > 0) {
    conditions.push(
      inArray(
        sql<string>`coalesce(${calculationCurrency.code}, ${requestedCurrency.code})`,
        currenciesFilter,
      ),
    );
  }

  return conditions;
}

const counterpartyParticipant = alias(
  dealParticipants,
  "compat_deal_counterparty_participant",
);
const calculationCurrency = alias(currencies, "compat_deal_calculation_currency");
const baseCurrency = alias(currencies, "compat_deal_base_currency");
const requestedCurrency = alias(currencies, "compat_deal_requested_currency");

function buildDealListQuery(input: CompatibilityDealsListQuery) {
  const conditions = buildDealListConditions(input);
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderFn = input.sortOrder === "asc" ? asc : desc;
  const orderByColumn =
    input.sortBy === "updatedAt" ? deals.updatedAt : deals.createdAt;

  return {
    where,
    orderBy: [orderFn(orderByColumn), orderFn(deals.id)] as const,
    select: {
      dealId: deals.id,
      status: deals.status,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      agentId: deals.agentId,
      agentName: user.name,
      orgName: opsClients.orgName,
      opsClientId: opsClients.id,
      requestedAmountMinor: deals.requestedAmountMinor,
      requestedCurrencyCode: requestedCurrency.code,
      requestedCurrencyPrecision: requestedCurrency.precision,
      counterpartyId: sql<string | null>`coalesce(${opsDeals.counterpartyId}, ${counterpartyParticipant.counterpartyId})`,
      closedAt: opsDeals.closedAt,
      comment: sql<string | null>`coalesce(${opsDeals.comment}, ${deals.comment})`,
      calcCurrencyCode: calculationCurrency.code,
      calcCurrencyPrecision: calculationCurrency.precision,
      originalAmountMinor: calculationSnapshots.originalAmountMinor,
      baseCurrencyCode: baseCurrency.code,
      baseCurrencyPrecision: baseCurrency.precision,
      totalWithExpensesInBaseMinor:
        calculationSnapshots.totalWithExpensesInBaseMinor,
      feeBps: calculationSnapshots.feeBps,
    },
  };
}

export async function listCompatibilityDeals(
  input: CompatibilityDealsListQuery,
): Promise<PaginatedList<CompatibilityDealListRow>> {
  const query = CompatibilityDealsListQuerySchema.parse(input);
  const queryParts = buildDealListQuery(query);

  const [rows, countRows] = await Promise.all([
    db
      .select(queryParts.select)
      .from(deals)
      .leftJoin(opsClients, eq(opsClients.customerId, deals.customerId))
      .leftJoin(user, eq(user.id, deals.agentId))
      .leftJoin(opsDeals, eq(opsDeals.dealId, deals.id))
      .leftJoin(
        counterpartyParticipant,
        and(
          eq(counterpartyParticipant.dealId, deals.id),
          eq(counterpartyParticipant.role, "counterparty"),
        ),
      )
      .leftJoin(calculations, eq(calculations.id, deals.calculationId))
      .leftJoin(
        calculationSnapshots,
        eq(calculations.currentSnapshotId, calculationSnapshots.id),
      )
      .leftJoin(
        calculationCurrency,
        eq(calculationSnapshots.calculationCurrencyId, calculationCurrency.id),
      )
      .leftJoin(
        baseCurrency,
        eq(calculationSnapshots.baseCurrencyId, baseCurrency.id),
      )
      .leftJoin(requestedCurrency, eq(deals.requestedCurrencyId, requestedCurrency.id))
      .where(queryParts.where)
      .orderBy(...queryParts.orderBy)
      .limit(query.limit)
      .offset(query.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(deals)
      .leftJoin(opsClients, eq(opsClients.customerId, deals.customerId))
      .leftJoin(opsDeals, eq(opsDeals.dealId, deals.id))
      .leftJoin(
        counterpartyParticipant,
        and(
          eq(counterpartyParticipant.dealId, deals.id),
          eq(counterpartyParticipant.role, "counterparty"),
        ),
      )
      .leftJoin(calculations, eq(calculations.id, deals.calculationId))
      .leftJoin(
        calculationSnapshots,
        eq(calculations.currentSnapshotId, calculationSnapshots.id),
      )
      .leftJoin(
        calculationCurrency,
        eq(calculationSnapshots.calculationCurrencyId, calculationCurrency.id),
      )
      .leftJoin(requestedCurrency, eq(deals.requestedCurrencyId, requestedCurrency.id))
      .where(queryParts.where),
  ]);

  return {
    data: (rows as DealListQueryRow[]).map(mapDealListRow),
    total: countRows[0]?.total ?? 0,
    limit: query.limit,
    offset: query.offset,
  };
}

async function listCompatibilityDealsUnpaginated(
  input: CompatibilityDealsStatisticsQuery,
) {
  const query = CompatibilityDealsListQuerySchema.parse({
    ...input,
    limit: 50000,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "asc",
  });

  return listCompatibilityDeals(query);
}

export async function getCompatibilityDealsStatistics(
  input: CompatibilityDealsStatisticsQuery,
) {
  const result = await listCompatibilityDealsUnpaginated(input);
  const byStatus = Object.fromEntries(
    COMPATIBILITY_DEAL_STATUS_VALUES.map((status) => [status, 0]),
  ) as Record<string, number>;

  let totalAmountInBase = 0;
  for (const deal of result.data) {
    byStatus[deal.status] = (byStatus[deal.status] ?? 0) + 1;
    totalAmountInBase += deal.amountInBase;
  }

  const activeStatuses = [
    "preparing_documents",
    "awaiting_funds",
    "awaiting_payment",
    "closing_documents",
  ] as const;

  return {
    totalCount: result.total,
    byStatus,
    totalAmount: totalAmountInBase.toFixed(2),
    totalAmountInBase,
    activeCount: activeStatuses.reduce(
      (sum, status) => sum + (byStatus[status] ?? 0),
      0,
    ),
    doneCount: byStatus.done ?? 0,
  };
}

export async function getCompatibilityDealsByDay(
  input: CompatibilityDealsStatisticsQuery,
) {
  const result = await listCompatibilityDealsUnpaginated(input);
  const buckets = new Map<
    string,
    {
      amount: number;
      count: number;
      closedAmount: number;
      closedCount: number;
      currencies: Record<string, number>;
    }
  >();

  for (const deal of result.data) {
    const date = deal.createdAt.slice(0, 10);
    const bucket = buckets.get(date) ?? {
      amount: 0,
      count: 0,
      closedAmount: 0,
      closedCount: 0,
      currencies: {},
    };

    bucket.count += 1;
    bucket.amount += deal.amountInBase;
    bucket.currencies[deal.currency] =
      (bucket.currencies[deal.currency] ?? 0) + deal.amount;

    if (deal.status === "done") {
      bucket.closedCount += 1;
      bucket.closedAmount += deal.amountInBase;
    }

    buckets.set(date, bucket);
  }

  let cumulativeCount = 0;
  let cumulativeAmount = 0;

  return {
    data: Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, bucket]) => {
        cumulativeCount += bucket.count;
        cumulativeAmount += bucket.amount;

        return {
          date,
          amount: bucket.amount,
          count: bucket.count,
          closedAmount: bucket.closedAmount,
          closedCount: bucket.closedCount,
          cumulativeAmount,
          cumulativeCount,
          USD: bucket.currencies.USD ?? 0,
          EUR: bucket.currencies.EUR ?? 0,
          CNY: bucket.currencies.CNY ?? 0,
          RUB: bucket.currencies.RUB ?? 0,
        };
      }),
  };
}

export async function listCompatibilityDealsGroupedByStatus(
  input: CompatibilityDealsStatisticsQuery = {},
) {
  const result = await listCompatibilityDealsUnpaginated(input);

  return {
    pending: result.data.filter((deal) =>
      ["draft", "submitted", "awaiting_funds"].includes(deal.status),
    ),
    inProgress: result.data.filter((deal) =>
      [
        "preparing_documents",
        "awaiting_payment",
        "closing_documents",
      ].includes(deal.status),
    ),
    done: result.data.filter((deal) => deal.status === "done"),
  };
}

async function findOpsClientIdByCustomerId(customerId: string) {
  const [row] = await db
    .select({ id: opsClients.id })
    .from(opsClients)
    .where(eq(opsClients.customerId, customerId))
    .limit(1);

  return row?.id ?? null;
}

async function findOpsDealExtensionByDealId(dealId: string) {
  const [row] = await db
    .select()
    .from(opsDeals)
    .where(eq(opsDeals.dealId, dealId))
    .limit(1);

  return row ?? null;
}

async function ensureOpsDealExtension(dealId: string) {
  await db
    .insert(opsDeals)
    .values({ dealId })
    .onConflictDoNothing({ target: opsDeals.dealId });
}

async function updateOpsDealExtension(
  dealId: string,
  input: CompatibilityUpdateDealDetailsInput,
) {
  await ensureOpsDealExtension(dealId);

  const values: Record<string, unknown> = {};

  if ("counterpartyId" in input) values.counterpartyId = input.counterpartyId ?? null;
  if ("organizationRequisiteId" in input) {
    values.organizationRequisiteId = input.organizationRequisiteId ?? null;
  }
  if ("invoiceNumber" in input) values.invoiceNumber = input.invoiceNumber ?? null;
  if ("invoiceDate" in input) values.invoiceDate = input.invoiceDate ?? null;
  if ("companyName" in input) values.companyName = input.companyName ?? null;
  if ("companyNameI18n" in input) values.companyNameI18n = input.companyNameI18n ?? null;
  if ("bankName" in input) values.bankName = input.bankName ?? null;
  if ("bankNameI18n" in input) values.bankNameI18n = input.bankNameI18n ?? null;
  if ("account" in input) values.account = input.account ?? null;
  if ("swiftCode" in input) values.swiftCode = input.swiftCode ?? null;
  if ("contractDate" in input) values.contractDate = input.contractDate ?? null;
  if ("contractNumber" in input) values.contractNumber = input.contractNumber ?? null;
  if ("costPrice" in input) values.costPrice = input.costPrice ?? null;
  if ("comment" in input) values.comment = input.comment ?? null;

  if (Object.keys(values).length === 0) {
    return;
  }

  await db.update(opsDeals).set(values).where(eq(opsDeals.dealId, dealId));
}

async function loadAgent(agentId: string | null) {
  if (!agentId) {
    return null;
  }

  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, agentId))
    .limit(1);

  return row ?? null;
}

export async function findCompatibilityDealById(ctx: AppContext, id: string) {
  const dealDetails = await ctx.dealsModule.deals.queries.findById(id);
  if (!dealDetails) {
    return null;
  }

  const [opsClientId, extension, agent, calculation] = await Promise.all([
    findOpsClientIdByCustomerId(dealDetails.customerId),
    findOpsDealExtensionByDealId(id),
    loadAgent(dealDetails.agentId),
    dealDetails.calculationId
      ? findCompatibilityCalculationById(dealDetails.calculationId)
      : Promise.resolve(null),
  ]);

  const client = opsClientId
    ? await ctx.operationsModule.clients.queries.findById(opsClientId)
    : null;
  const contract = opsClientId
    ? await resolveEffectiveCompatibilityContractByClientId(ctx, opsClientId)
    : null;

  let organization = null;
  let organizationRequisite = null;

  const organizationRequisiteId =
    extension?.organizationRequisiteId ?? contract?.organizationRequisiteId ?? null;

  if (organizationRequisiteId) {
    const requisite = await getOrganizationBankRequisiteOrThrow(
      ctx,
      organizationRequisiteId,
    );
    organizationRequisite = await serializeOrganizationRequisiteForDocuments(
      ctx,
      requisite,
    );
    organization = await ctx.partiesModule.organizations.queries.findById(
      requisite.ownerId,
    );
  }

  const subAgent =
    client?.subAgentCounterpartyId != null
      ? await ctx.partiesModule.subAgentProfiles.queries.findById(
          client.subAgentCounterpartyId,
        )
      : null;

  const counterpartyParticipant =
    dealDetails.participants.find((participant) => participant.role === "counterparty") ??
    null;

  return {
    deal: {
      id: dealDetails.id,
      calculationId: dealDetails.calculationId,
      counterpartyId:
        extension?.counterpartyId ?? counterpartyParticipant?.counterpartyId ?? null,
      organizationRequisiteId,
      status: dealDetails.status,
      invoiceNumber: extension?.invoiceNumber ?? null,
      invoiceDate: extension?.invoiceDate ?? null,
      companyName: extension?.companyName ?? null,
      companyNameI18n: extension?.companyNameI18n ?? null,
      bankName: extension?.bankName ?? null,
      bankNameI18n: extension?.bankNameI18n ?? null,
      account: extension?.account ?? null,
      swiftCode: extension?.swiftCode ?? null,
      contractDate: extension?.contractDate ?? null,
      contractNumber: extension?.contractNumber ?? null,
      costPrice: extension?.costPrice ?? null,
      closedAt:
        extension?.closedAt ??
        (dealDetails.status === "done" ? dealDetails.updatedAt.toISOString() : null),
      comment: extension?.comment ?? dealDetails.comment,
      agentId: dealDetails.agentId,
      reason: dealDetails.reason,
      intakeComment: dealDetails.intakeComment,
      requestedAmount: dealDetails.requestedAmount,
      requestedCurrencyId: dealDetails.requestedCurrencyId,
      createdAt: dealDetails.createdAt.toISOString(),
      updatedAt: dealDetails.updatedAt.toISOString(),
    },
    calculation,
    client,
    contract,
    organizationRequisite,
    organization,
    agent,
    subAgent,
  };
}

export async function createCompatibilityDeal(
  ctx: AppContext,
  input: z.infer<typeof CreateDealInputSchema>,
  actorUserId: string,
  idempotencyKey: string,
) {
  return ctx.dealsModule.deals.commands.create({
    ...input,
    actorUserId,
    idempotencyKey,
  });
}

export async function transitionCompatibilityDealStatus(
  ctx: AppContext,
  dealId: string,
  input: z.infer<typeof TransitionDealStatusInputSchema>,
  actorUserId: string,
) {
  const updated = await ctx.dealsModule.deals.commands.transitionStatus({
    actorUserId,
    comment: input.comment,
    dealId,
    status: input.status,
  });

  if (
    ["preparing_documents", "awaiting_funds", "awaiting_payment", "closing_documents", "done", "cancelled"].includes(
      updated.status,
    )
  ) {
    await ensureOpsDealExtension(dealId);
    await db
      .update(opsDeals)
      .set({
        status: updated.status as
          | "preparing_documents"
          | "awaiting_funds"
          | "awaiting_payment"
          | "closing_documents"
          | "done"
          | "cancelled",
        ...(updated.status === "done"
          ? { closedAt: updated.updatedAt.toISOString() }
          : {}),
      })
      .where(eq(opsDeals.dealId, dealId));
  }

  return updated;
}

export async function updateCompatibilityDealDetails(
  ctx: AppContext,
  dealId: string,
  input: CompatibilityUpdateDealDetailsInput,
  actorUserId: string,
) {
  const parsed = CompatibilityUpdateDealDetailsInputSchema.parse(input);
  const canonicalPatch: z.infer<typeof UpdateDealIntakeInputSchema> = {};

  if ("counterpartyId" in parsed) {
    canonicalPatch.counterpartyId = parsed.counterpartyId;
  }
  if ("comment" in parsed) {
    canonicalPatch.comment = parsed.comment;
  }

  if (Object.keys(canonicalPatch).length > 0) {
    await ctx.dealsModule.deals.commands.updateIntake({
      ...canonicalPatch,
      actorUserId,
      dealId,
    });
  }

  await updateOpsDealExtension(dealId, parsed);

  const updated = await findCompatibilityDealById(ctx, dealId);
  if (!updated) {
    throw new NotFoundError("Deal", dealId);
  }

  return updated;
}

export async function closeCompatibilityDeal(
  ctx: AppContext,
  dealId: string,
  actorUserId: string,
) {
  const updated = await transitionCompatibilityDealStatus(
    ctx,
    dealId,
    { status: "done", comment: null },
    actorUserId,
  );
  await ensureOpsDealExtension(dealId);
  await db
    .update(opsDeals)
    .set({ closedAt: updated.updatedAt.toISOString() })
    .where(eq(opsDeals.dealId, dealId));

  return updated;
}

async function getOpsDealExtensionIdByCanonicalDealId(
  dealId: string,
  options?: { createIfMissing?: boolean },
) {
  if (options?.createIfMissing) {
    await ensureOpsDealExtension(dealId);
  }

  const [row] = await db
    .select({ id: opsDeals.id })
    .from(opsDeals)
    .where(eq(opsDeals.dealId, dealId))
    .limit(1);

  if (!row) {
    if (options?.createIfMissing) {
      throw new NotFoundError("Deal", dealId);
    }

    return null;
  }

  return row.id;
}

export async function listCompatibilityDealDocuments(dealId: string) {
  const opsDealId = await getOpsDealExtensionIdByCanonicalDealId(dealId);
  if (!opsDealId) {
    return [];
  }

  const rows = await db
    .select()
    .from(opsDealDocuments)
    .where(eq(opsDealDocuments.dealId, opsDealId))
    .orderBy(desc(opsDealDocuments.createdAt), desc(opsDealDocuments.id));

  return rows.map((row) => ({
    ...row,
    dealId,
  }));
}

export async function uploadCompatibilityDealDocument(
  ctx: AppContext,
  input: {
    buffer: Buffer;
    dealId: string;
    description?: string | null;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string | null;
  },
) {
  if (!ctx.objectStorage) {
    throw new Error("Document storage not configured");
  }

  const opsDealId = await getOpsDealExtensionIdByCanonicalDealId(input.dealId, {
    createIfMissing: true,
  });
  const s3Key = `deals/${opsDealId}/${Date.now()}-${input.fileName}`;

  await ctx.objectStorage.upload(s3Key, input.buffer, input.mimeType);

  const [created] = await db
    .insert(opsDealDocuments)
    .values({
      dealId: opsDealId,
      description: input.description ?? null,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      s3Key,
      uploadedBy: input.uploadedBy,
    })
    .returning();

  return {
    ...created!,
    dealId: input.dealId,
  };
}

export async function deleteCompatibilityDealDocument(documentId: number) {
  await db.delete(opsDealDocuments).where(eq(opsDealDocuments.id, documentId));
}

export async function getCompatibilityDealDocumentDownloadUrl(
  ctx: AppContext,
  dealId: string,
  documentId: number,
) {
  if (!ctx.objectStorage) {
    return "";
  }

  const opsDealId = await getOpsDealExtensionIdByCanonicalDealId(dealId);
  if (!opsDealId) {
    return "";
  }

  const [row] = await db
    .select({ s3Key: opsDealDocuments.s3Key })
    .from(opsDealDocuments)
    .where(
      and(
        eq(opsDealDocuments.id, documentId),
        eq(opsDealDocuments.dealId, opsDealId),
      ),
    )
    .limit(1);

  if (!row) {
    return "";
  }

  return ctx.objectStorage.getSignedUrl(row.s3Key);
}

export async function listCompatibilityDealCalculations(dealId: string) {
  return listCompatibilityCalculationsByDealId(dealId);
}
