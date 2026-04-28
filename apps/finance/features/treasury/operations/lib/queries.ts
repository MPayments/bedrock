import { cache } from "react";
import { z } from "zod";

import { readEntityById, readPaginatedList } from "@/lib/api/query";
import type { HttpResponseLike } from "@/lib/api/response";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { getServerApiClient } from "@/lib/api/server-client";
import {
  FinanceDealQuoteExecutionSchema,
  type FinanceDealQuoteExecution,
} from "@/features/treasury/deals/lib/queries";
import {
  FinanceDealPaymentStepSchema,
  type FinanceDealPaymentStep,
} from "@/features/treasury/steps/lib/schemas";

import type { TreasuryOperationsSearchParams } from "./validations";

const TreasuryStepsListResponseSchema = createPaginatedResponseSchema(
  FinanceDealPaymentStepSchema,
);
const TreasuryQuoteExecutionsListResponseSchema =
  createPaginatedResponseSchema(FinanceDealQuoteExecutionSchema);
const TreasuryOrderStepSchema = z.object({
  createdAt: z.iso.datetime(),
  fromAmountMinor: z.string().nullable(),
  fromCurrencyId: z.uuid(),
  fromParty: z.object({
    displayName: z.string().nullable().optional(),
    entityKind: z.string().nullable().optional(),
    id: z.uuid(),
    requisiteId: z.uuid().nullable(),
    snapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
  id: z.uuid(),
  kind: z.enum([
    "payin",
    "fx_conversion",
    "payout",
    "intracompany_transfer",
    "intercompany_funding",
    "internal_transfer",
    "quote_execution",
  ]),
  paymentStepId: z.uuid().nullable(),
  quoteExecutionId: z.uuid().nullable(),
  quoteId: z.uuid().nullable(),
  rate: z
    .object({
      lockedSide: z.enum(["in", "out"]),
      value: z.string(),
    })
    .nullable(),
  sequence: z.number().int().positive(),
  sourceRef: z.string(),
  toAmountMinor: z.string().nullable(),
  toCurrencyId: z.uuid(),
  toParty: z.object({
    displayName: z.string().nullable().optional(),
    entityKind: z.string().nullable().optional(),
    id: z.uuid(),
    requisiteId: z.uuid().nullable(),
    snapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
  updatedAt: z.iso.datetime(),
});
const TreasuryOrderSchema = z.object({
  activatedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  description: z.string().nullable(),
  id: z.uuid(),
  state: z.enum(["draft", "active", "completed", "cancelled", "failed"]),
  steps: z.array(TreasuryOrderStepSchema),
  type: z.enum([
    "single_payment",
    "fx_exchange",
    "rebalance",
    "pre_fund",
    "liquidity_purchase",
  ]),
  updatedAt: z.iso.datetime(),
});
const TreasuryInventoryPositionSchema = z.object({
  acquiredAmountMinor: z.string(),
  availableAmountMinor: z.string(),
  costAmountMinor: z.string(),
  costCurrencyId: z.uuid(),
  createdAt: z.iso.datetime(),
  currencyId: z.uuid(),
  id: z.uuid(),
  ledger: z.object({
    currency: z.string(),
    inventoryAcquiredMinor: z.string(),
    inventoryAvailableMinor: z.string(),
    inventoryReservedMinor: z.string(),
    ledgerAvailableMinor: z.string(),
    ledgerBalanceMinor: z.string(),
    ledgerReservedMinor: z.string(),
    reconciliationStatus: z.enum([
      "matched",
      "inventory_exceeds_balance",
      "missing_balance",
    ]),
    subject: z.object({
      bookId: z.uuid(),
      currency: z.string(),
      subjectId: z.string(),
      subjectType: z.string(),
    }),
  }),
  ledgerSubjectType: z.literal("organization_requisite"),
  ownerBookId: z.uuid(),
  ownerPartyId: z.uuid(),
  ownerRequisiteId: z.uuid(),
  sourceOrderId: z.uuid(),
  sourcePostingDocumentId: z.uuid(),
  sourcePostingDocumentKind: z.literal("fx_execute"),
  sourceQuoteExecutionId: z.uuid(),
  state: z.enum(["open", "exhausted", "cancelled"]),
  updatedAt: z.iso.datetime(),
});
const TreasuryInventoryAllocationSchema = z.object({
  amountMinor: z.string(),
  costAmountMinor: z.string(),
  consumedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  currencyId: z.uuid(),
  dealId: z.uuid(),
  id: z.uuid(),
  ledgerHoldRef: z.string(),
  ownerBookId: z.uuid(),
  ownerRequisiteId: z.uuid(),
  positionId: z.uuid(),
  quoteId: z.uuid().nullable(),
  releasedAt: z.iso.datetime().nullable(),
  reservedAt: z.iso.datetime(),
  state: z.enum(["reserved", "consumed", "released"]),
  updatedAt: z.iso.datetime(),
});
const TreasuryOrdersListResponseSchema =
  createPaginatedResponseSchema(TreasuryOrderSchema);
const TreasuryInventoryPositionsListResponseSchema =
  createPaginatedResponseSchema(TreasuryInventoryPositionSchema);
const TreasuryInventoryAllocationsListResponseSchema =
  createPaginatedResponseSchema(TreasuryInventoryAllocationSchema);
const TREASURY_OPERATION_PAGE_LIMIT = 100;

export type TreasuryPaymentStepOperation = FinanceDealPaymentStep & {
  runtimeType: "payment_step";
};
export type TreasuryQuoteExecutionOperation = FinanceDealQuoteExecution & {
  kind: "quote_execution";
  purpose: "deal_leg" | "standalone_payment";
  runtimeType: "quote_execution";
};
export type TreasuryOperationRow =
  | TreasuryPaymentStepOperation
  | TreasuryQuoteExecutionOperation;
export type TreasuryOrderRow = z.infer<typeof TreasuryOrderSchema>;
export type TreasuryInventoryPositionRow = z.infer<
  typeof TreasuryInventoryPositionSchema
>;
export type TreasuryInventoryAllocationRow = z.infer<
  typeof TreasuryInventoryAllocationSchema
>;
export type TreasuryOperationsListResult = {
  data: TreasuryOperationRow[];
  limit: number;
  offset: number;
  total: number;
};
export type TreasuryOrdersListResult = PaginatedResponse<TreasuryOrderRow>;
export type TreasuryInventoryPositionsListResult =
  PaginatedResponse<TreasuryInventoryPositionRow>;
export type TreasuryOperationDetails = TreasuryOperationRow;
export type TreasuryOrderDetails = TreasuryOrderRow & {
  childOperations: TreasuryOperationRow[];
  inventoryPositions: TreasuryInventoryPositionRow[];
};
export type TreasuryInventoryPositionDetails = TreasuryInventoryPositionRow & {
  allocations: TreasuryInventoryAllocationRow[];
  sourceOrder: TreasuryOrderRow | null;
};

type PaginatedResponse<TItem> = {
  data: TItem[];
  limit: number;
  offset: number;
  total: number;
};

function emptyPage<TItem>(): PaginatedResponse<TItem> {
  return {
    data: [],
    limit: TREASURY_OPERATION_PAGE_LIMIT,
    offset: 0,
    total: 0,
  };
}

const PAYMENT_STEP_PURPOSE_VALUES = [
  "deal_leg",
  "pre_fund",
  "standalone_payment",
] as const;
const PAYMENT_STEP_STATE_VALUES = [
  "draft",
  "scheduled",
  "pending",
  "processing",
  "completed",
  "failed",
  "returned",
  "cancelled",
  "skipped",
] as const;
const QUOTE_EXECUTION_STATE_VALUES = [
  "draft",
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "expired",
] as const;

type PaymentStepPurpose = (typeof PAYMENT_STEP_PURPOSE_VALUES)[number];
type PaymentStepState = (typeof PAYMENT_STEP_STATE_VALUES)[number];
type QuoteExecutionState = (typeof QUOTE_EXECUTION_STATE_VALUES)[number];

function parsePurpose(value: unknown): PaymentStepPurpose | undefined {
  if (typeof value !== "string") return undefined;
  return (PAYMENT_STEP_PURPOSE_VALUES as readonly string[]).includes(value)
    ? (value as PaymentStepPurpose)
    : undefined;
}

function parseStates(value: unknown): PaymentStepState[] | undefined {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const filtered = raw.filter((entry): entry is PaymentStepState =>
    typeof entry === "string" &&
    (PAYMENT_STEP_STATE_VALUES as readonly string[]).includes(entry),
  );
  return filtered.length > 0 ? filtered : undefined;
}

function parseQuoteExecutionStates(
  value: unknown,
): QuoteExecutionState[] | undefined {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  const filtered = raw.filter((entry): entry is QuoteExecutionState =>
    typeof entry === "string" &&
    (QUOTE_EXECUTION_STATE_VALUES as readonly string[]).includes(entry),
  );
  return filtered.length > 0 ? filtered : undefined;
}

function resolvePagination(search: TreasuryOperationsSearchParams) {
  const perPage = typeof search.perPage === "number" ? search.perPage : 10;
  const page = typeof search.page === "number" ? search.page : 1;
  return {
    limit: perPage,
    offset: Math.max(0, (page - 1) * perPage),
  };
}

async function readAllPaginatedRows<TItem>({
  context,
  request,
  schema,
}: {
  context: string;
  request: (pagination: {
    limit: string;
    offset: string;
  }) => Promise<HttpResponseLike>;
  schema: z.ZodType<PaginatedResponse<TItem>>;
}): Promise<PaginatedResponse<TItem>> {
  const rows: TItem[] = [];
  let offset = 0;

  while (true) {
    const { data } = await readPaginatedList({
      request: () =>
        request({
          limit: String(TREASURY_OPERATION_PAGE_LIMIT),
          offset: String(offset),
        }),
      schema,
      context,
    });
    rows.push(...data.data);
    offset += data.limit;
    if (offset >= data.total) {
      return {
        data: rows,
        limit: TREASURY_OPERATION_PAGE_LIMIT,
        offset: 0,
        total: data.total,
      };
    }
  }
}

/**
 * Build the query object that the typed API client sends to `GET /v1/treasury/steps`.
 * The client infers its types from the Hono route definition — so non-string
 * values must be coerced to the expected representation.
 */
function buildListQuery(search: TreasuryOperationsSearchParams): Record<
  string,
  string | string[] | undefined
> | null {
  const { limit, offset } = resolvePagination(search);
  const query: Record<string, string | string[] | undefined> = {
    limit: String(limit),
    offset: String(offset),
  };
  const purpose = parsePurpose(search.purpose);
  if (purpose) query.purpose = purpose;
  const states = parseStates(search.state);
  if (Array.isArray(search.state) && search.state.length > 0 && !states) {
    return null;
  }
  if (states) query.state = states;
  if (typeof search.dealId === "string" && search.dealId) {
    query.dealId = search.dealId;
  }
  if (typeof search.batchId === "string" && search.batchId) {
    query.batchId = search.batchId;
  }
  const createdRange = Array.isArray(search.createdAt) ? search.createdAt : [];
  const createdFrom = coerceIsoDateTime(createdRange[0]);
  if (createdFrom) query.createdFrom = createdFrom;
  const createdTo = coerceIsoDateTime(createdRange[1]);
  if (createdTo) query.createdTo = createdTo;
  return query;
}

function buildQuoteExecutionsListQuery(
  search: TreasuryOperationsSearchParams,
): Record<string, string | undefined> | null {
  const purpose = parsePurpose(search.purpose);
  if (purpose === "pre_fund") return null;

  const states = parseQuoteExecutionStates(search.state);
  const query: Record<string, string | undefined> = {
    limit: "100",
    offset: "0",
  };
  if (typeof search.dealId === "string" && search.dealId) {
    query.dealId = search.dealId;
  }
  if (typeof search.batchId === "string" && search.batchId) {
    query.treasuryOrderId = search.batchId;
  }
  if (states?.length === 1) {
    query.state = states[0];
  }
  return query;
}

function coerceIsoDateTime(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export async function getTreasuryOperations(
  search: TreasuryOperationsSearchParams = {},
): Promise<TreasuryOperationsListResult> {
  const client = await getServerApiClient();
  const { limit, offset } = resolvePagination(search);
  const stepsQuery = buildListQuery(search);
  const quoteExecutionsQuery = buildQuoteExecutionsListQuery(search);
  const [stepsResult, quoteExecutionsResult] = await Promise.all([
    stepsQuery
      ? readAllPaginatedRows<FinanceDealPaymentStep>({
          request: ({ limit: pageLimit, offset: pageOffset }) =>
            client.v1.treasury.steps.$get(
              {
                query: { ...stepsQuery, limit: pageLimit, offset: pageOffset },
              },
              { init: { cache: "no-store" } },
            ),
          schema: TreasuryStepsListResponseSchema,
          context: "Не удалось загрузить операции казначейства",
        })
      : Promise.resolve(emptyPage<FinanceDealPaymentStep>()),
    quoteExecutionsQuery
      ? readAllPaginatedRows<FinanceDealQuoteExecution>({
          request: ({ limit: pageLimit, offset: pageOffset }) =>
            client.v1.treasury["quote-executions"].$get(
              {
                query: {
                  ...quoteExecutionsQuery,
                  limit: pageLimit,
                  offset: pageOffset,
                },
              },
              { init: { cache: "no-store" } },
            ),
          schema: TreasuryQuoteExecutionsListResponseSchema,
          context: "Не удалось загрузить исполнения FX-котировок",
        })
      : Promise.resolve(emptyPage<FinanceDealQuoteExecution>()),
  ]);

  const purpose = parsePurpose(search.purpose);
  const quoteStates = parseQuoteExecutionStates(search.state);
  const createdRange = Array.isArray(search.createdAt) ? search.createdAt : [];
  const createdFrom = coerceIsoDateTime(createdRange[0]);
  const createdTo = coerceIsoDateTime(createdRange[1]);
  const quoteRows = quoteExecutionsResult.data
    .filter((execution) =>
      purpose === "deal_leg"
        ? execution.origin.type === "deal_execution_leg"
        : purpose === "standalone_payment"
          ? execution.origin.type !== "deal_execution_leg"
          : true,
    )
    .filter((execution) =>
      quoteStates ? quoteStates.includes(execution.state) : true,
    )
    .filter((execution) =>
      createdFrom ? execution.createdAt >= createdFrom : true,
    )
    .filter((execution) => (createdTo ? execution.createdAt <= createdTo : true))
    .map((execution): TreasuryQuoteExecutionOperation => ({
      ...execution,
      kind: "quote_execution",
      purpose:
        execution.origin.type === "deal_execution_leg"
          ? "deal_leg"
          : "standalone_payment",
      runtimeType: "quote_execution",
    }));
  const data = [
    ...stepsResult.data.map((step): TreasuryPaymentStepOperation => ({
      ...step,
      runtimeType: "payment_step",
    })),
    ...quoteRows,
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    data: data.slice(offset, offset + limit),
    limit,
    offset,
    total: data.length,
  };
}

function buildOrderListQuery(
  search: TreasuryOperationsSearchParams,
): Record<string, string | undefined> {
  const { limit, offset } = resolvePagination(search);
  const state =
    typeof search.state?.[0] === "string" && search.state[0]
      ? search.state[0]
      : undefined;
  return {
    limit: String(limit),
    offset: String(offset),
    state,
  };
}

export async function getTreasuryOrders(
  search: TreasuryOperationsSearchParams = {},
): Promise<TreasuryOrdersListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.treasury.orders.$get(
        { query: buildOrderListQuery(search) },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryOrdersListResponseSchema,
    context: "Не удалось загрузить казначейские ордера",
  });
  return data;
}

function buildInventoryListQuery(
  search: TreasuryOperationsSearchParams,
): Record<string, string | undefined> {
  const { limit, offset } = resolvePagination(search);
  const state =
    typeof search.state?.[0] === "string" && search.state[0]
      ? search.state[0]
      : undefined;
  return {
    currencyId:
      typeof search.currencyId === "string" && search.currencyId
        ? search.currencyId
        : undefined,
    limit: String(limit),
    offset: String(offset),
    state,
  };
}

export async function getTreasuryInventoryPositions(
  search: TreasuryOperationsSearchParams = {},
): Promise<TreasuryInventoryPositionsListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.treasury.orders.inventory.positions.$get(
        { query: buildInventoryListQuery(search) },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryInventoryPositionsListResponseSchema,
    context: "Не удалось загрузить инвентарь казначейства",
  });
  return data;
}

async function getTreasuryOrderByIdUncached(
  id: string,
): Promise<TreasuryOrderRow | null> {
  return readEntityById({
    id,
    resourceName: "казначейский ордер",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.treasury.orders[":orderId"].$get(
        { param: { orderId: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: TreasuryOrderSchema,
  });
}

async function getTreasuryInventoryPositionByIdUncached(
  id: string,
): Promise<TreasuryInventoryPositionRow | null> {
  return readEntityById({
    id,
    resourceName: "позицию инвентаря казначейства",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.treasury.orders.inventory.positions[":positionId"].$get(
        { param: { positionId: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: TreasuryInventoryPositionSchema,
  });
}

async function listInventoryPositionsBySourceOrder(
  sourceOrderId: string,
): Promise<TreasuryInventoryPositionRow[]> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.treasury.orders.inventory.positions.$get(
        {
          query: {
            limit: "100",
            offset: "0",
            sourceOrderId,
          },
        },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryInventoryPositionsListResponseSchema,
    context: "Не удалось загрузить позиции инвентаря по ордеру",
  });
  return data.data;
}

async function listInventoryAllocationsByPosition(
  positionId: string,
): Promise<TreasuryInventoryAllocationRow[]> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.treasury.orders.inventory.allocations.$get(
        {
          query: {
            limit: "100",
            offset: "0",
            positionId,
          },
        },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryInventoryAllocationsListResponseSchema,
    context: "Не удалось загрузить аллокации инвентаря",
  });
  return data.data;
}

async function getPaymentStepById(id: string) {
  return readEntityById({
    id,
    resourceName: "операцию казначейства",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.treasury.steps[":stepId"].$get(
        {
          param: { stepId: validId },
        },
        { init: { cache: "no-store" } },
      );
    },
    schema: FinanceDealPaymentStepSchema,
  });
}

async function getQuoteExecutionById(id: string) {
  return readEntityById({
    id,
    resourceName: "исполнение FX-котировки",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.treasury["quote-executions"][":executionId"].$get(
        {
          param: { executionId: validId },
        },
        { init: { cache: "no-store" } },
      );
    },
    schema: FinanceDealQuoteExecutionSchema,
  });
}

const getTreasuryOperationByIdUncached = async (
  id: string,
): Promise<TreasuryOperationDetails | null> => {
  const step = await getPaymentStepById(id);
  if (step) {
    return { ...step, runtimeType: "payment_step" };
  }
  const execution = await getQuoteExecutionById(id);
  if (!execution) return null;
  return {
    ...execution,
    kind: "quote_execution",
    purpose:
      execution.origin.type === "deal_execution_leg"
        ? "deal_leg"
        : "standalone_payment",
    runtimeType: "quote_execution",
  };
};

export const getTreasuryOperationById = cache(getTreasuryOperationByIdUncached);

const getTreasuryOrderDetailsUncached = async (
  id: string,
): Promise<TreasuryOrderDetails | null> => {
  const order = await getTreasuryOrderByIdUncached(id);
  if (!order) return null;

  const [childOperations, inventoryPositions] = await Promise.all([
    Promise.all(
      order.steps
        .flatMap((step) => [step.paymentStepId, step.quoteExecutionId])
        .filter((childId): childId is string => Boolean(childId))
        .map((childId) => getTreasuryOperationByIdUncached(childId)),
    ),
    listInventoryPositionsBySourceOrder(order.id),
  ]);

  return {
    ...order,
    childOperations: childOperations.filter(
      (operation): operation is TreasuryOperationRow => Boolean(operation),
    ),
    inventoryPositions,
  };
};

const getTreasuryInventoryPositionDetailsUncached = async (
  id: string,
): Promise<TreasuryInventoryPositionDetails | null> => {
  const position = await getTreasuryInventoryPositionByIdUncached(id);
  if (!position) return null;
  const [allocations, sourceOrder] = await Promise.all([
    listInventoryAllocationsByPosition(position.id),
    getTreasuryOrderByIdUncached(position.sourceOrderId),
  ]);
  return {
    ...position,
    allocations,
    sourceOrder,
  };
};

export const getTreasuryOrderDetails = cache(getTreasuryOrderDetailsUncached);
export const getTreasuryInventoryPositionDetails = cache(
  getTreasuryInventoryPositionDetailsUncached,
);
