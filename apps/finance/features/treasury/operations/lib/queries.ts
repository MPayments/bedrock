import { cache } from "react";
import { z } from "zod";

import { readEntityById, readPaginatedList } from "@/lib/api/query";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { getServerApiClient } from "@/lib/api/server-client";
import {
  FinanceDealPaymentStepSchema,
  type FinanceDealPaymentStep,
} from "@/features/treasury/steps/lib/schemas";

import type { TreasuryOperationsSearchParams } from "./validations";

const TreasuryStepsListResponseSchema = createPaginatedResponseSchema(
  FinanceDealPaymentStepSchema,
);

export type TreasuryOperationRow = FinanceDealPaymentStep;
export type TreasuryOperationsListResult = z.infer<
  typeof TreasuryStepsListResponseSchema
>;
export type TreasuryOperationDetails = FinanceDealPaymentStep;

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

type PaymentStepPurpose = (typeof PAYMENT_STEP_PURPOSE_VALUES)[number];
type PaymentStepState = (typeof PAYMENT_STEP_STATE_VALUES)[number];

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
> {
  const { limit, offset } = resolvePagination(search);
  const query: Record<string, string | string[] | undefined> = {
    limit: String(limit),
    offset: String(offset),
  };
  const purpose = parsePurpose(search.purpose);
  if (purpose) query.purpose = purpose;
  const states = parseStates(search.state);
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
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.treasury.steps.$get(
        {
          query: buildListQuery(search),
        },
        { init: { cache: "no-store" } },
      ),
    schema: TreasuryStepsListResponseSchema,
    context: "Не удалось загрузить операции казначейства",
  });

  return data;
}

const getTreasuryOperationByIdUncached = async (
  id: string,
): Promise<TreasuryOperationDetails | null> =>
  readEntityById({
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

export const getTreasuryOperationById = cache(getTreasuryOperationByIdUncached);
