import { cache } from "react";

import { readEntityById, readPaginatedList } from "@/lib/api/query";
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
export type TreasuryOperationsListResult = {
  data: TreasuryOperationRow[];
  limit: number;
  offset: number;
  total: number;
};
export type TreasuryOperationDetails = TreasuryOperationRow;

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
      ? readPaginatedList({
          request: () =>
            client.v1.treasury.steps.$get(
              {
                query: { ...stepsQuery, limit: "100", offset: "0" },
              },
              { init: { cache: "no-store" } },
            ),
          schema: TreasuryStepsListResponseSchema,
          context: "Не удалось загрузить операции казначейства",
        })
      : Promise.resolve({
          data: { data: [] as FinanceDealPaymentStep[], limit: 100, offset: 0, total: 0 },
          response: null,
        }),
    quoteExecutionsQuery
      ? readPaginatedList({
          request: () =>
            client.v1.treasury["quote-executions"].$get(
              {
                query: quoteExecutionsQuery,
              },
              { init: { cache: "no-store" } },
            ),
          schema: TreasuryQuoteExecutionsListResponseSchema,
          context: "Не удалось загрузить исполнения FX-котировок",
        })
      : Promise.resolve({
          data: { data: [], limit: 100, offset: 0, total: 0 },
          response: null,
        }),
  ]);

  const purpose = parsePurpose(search.purpose);
  const quoteStates = parseQuoteExecutionStates(search.state);
  const createdRange = Array.isArray(search.createdAt) ? search.createdAt : [];
  const createdFrom = coerceIsoDateTime(createdRange[0]);
  const createdTo = coerceIsoDateTime(createdRange[1]);
  const quoteRows = quoteExecutionsResult.data.data
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
    ...stepsResult.data.data.map((step): TreasuryPaymentStepOperation => ({
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
