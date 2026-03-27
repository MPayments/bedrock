import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { resolveInternalApiUrl } from "@/lib/api/internal-base-url";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { requestOk, readJsonWithSchema } from "@/lib/api/response";
import { isUuid } from "@/lib/resources/http";

import type { OperationsSearchParams } from "./validations";

const OperationSummarySchema = z.object({
  id: z.uuid(),
  sourceType: z.string(),
  sourceId: z.string(),
  operationCode: z.string(),
  operationVersion: z.number().int(),
  postingDate: z.iso.datetime(),
  status: z.enum(["pending", "posted", "failed"]),
  error: z.string().nullable(),
  postedAt: z.iso.datetime().nullable(),
  outboxAttempts: z.number().int(),
  lastOutboxErrorAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  postingCount: z.number().int(),
  bookIds: z.array(z.string()),
  currencies: z.array(z.string()),
});

const OperationPostingSchema = z.object({
  id: z.uuid(),
  lineNo: z.number().int(),
  bookId: z.uuid(),
  bookName: z.string().nullable(),
  debitInstanceId: z.uuid(),
  debitAccountNo: z.string().nullable(),
  debitDimensions: z.record(z.string(), z.string()).nullable(),
  creditInstanceId: z.uuid(),
  creditAccountNo: z.string().nullable(),
  creditDimensions: z.record(z.string(), z.string()).nullable(),
  postingCode: z.string(),
  currency: z.string(),
  currencyPrecision: z.number().int(),
  amount: z.string(),
  memo: z.string().nullable(),
  context: z.record(z.string(), z.string()).nullable(),
  createdAt: z.iso.datetime(),
});

const OperationTbPlanSchema = z.object({
  id: z.uuid(),
  lineNo: z.number().int(),
  type: z.enum(["create", "post_pending", "void_pending"]),
  transferId: z.string(),
  debitTbAccountId: z.string().nullable(),
  creditTbAccountId: z.string().nullable(),
  tbLedger: z.number().int(),
  amount: z.string(),
  code: z.number().int(),
  pendingRef: z.string().nullable(),
  pendingId: z.string().nullable(),
  isLinked: z.boolean(),
  isPending: z.boolean(),
  timeoutSeconds: z.number().int(),
  status: z.enum(["pending", "posted", "failed"]),
  error: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const OperationDetailsSchema = z.object({
  operation: OperationSummarySchema,
  postings: z.array(OperationPostingSchema),
  tbPlans: z.array(OperationTbPlanSchema),
  dimensionLabels: z.record(z.string(), z.string()),
});

const OperationsListResponseSchema = createPaginatedResponseSchema(
  OperationSummarySchema,
);

export type OperationSummaryDto = z.infer<typeof OperationSummarySchema>;
export type OperationDetailsDto = z.infer<typeof OperationDetailsSchema>;

const OPERATIONS_SORTABLE_COLUMNS = new Set(["createdAt", "postingDate", "postedAt"]);

async function fetchApi(path: string) {
  const requestHeaders = await headers();

  return fetch(resolveInternalApiUrl(path), {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    cache: "no-store",
  });
}

function appendMany(query: URLSearchParams, key: string, values?: string[]) {
  if (!values || values.length === 0) {
    return;
  }

  for (const value of values) {
    query.append(key, value);
  }
}

function createOperationsListQuery(search: OperationsSearchParams) {
  const query = new URLSearchParams();
  const page = search.page ?? 1;
  const perPage = search.perPage ?? 10;

  query.set("limit", String(perPage));
  query.set("offset", String(Math.max(0, (page - 1) * perPage)));

  const sort = search.sort?.[0];
  if (sort && OPERATIONS_SORTABLE_COLUMNS.has(sort.id)) {
    query.set("sortBy", sort.id);
    query.set("sortOrder", sort.desc ? "desc" : "asc");
  }

  if (search.query) {
    query.set("query", search.query);
  }

  appendMany(query, "status", search.status);
  appendMany(query, "operationCode", search.operationCode);
  appendMany(query, "sourceType", search.sourceType);

  if (search.sourceId) {
    query.set("sourceId", search.sourceId);
  }

  if (search.bookId) {
    query.set("bookId", search.bookId);
  }

  if (search.dimensionFilters) {
    for (const [key, values] of Object.entries(search.dimensionFilters)) {
      appendMany(query, `dimension.${key}`, values);
    }
  }

  return query;
}

export async function getOperations(
  search: OperationsSearchParams,
): Promise<z.infer<typeof OperationsListResponseSchema>> {
  const query = createOperationsListQuery(search);

  const response = await requestOk(
    await fetchApi(`/v1/documents/journal?${query.toString()}`),
    "Не удалось загрузить операции",
  );

  return readJsonWithSchema(response, OperationsListResponseSchema);
}

const getOperationByIdUncached = async (
  operationId: string,
): Promise<OperationDetailsDto | null> => {
  if (!isUuid(operationId)) {
    return null;
  }

  const response = await fetchApi(`/v1/documents/journal/${operationId}`);

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить детали операции");
  return readJsonWithSchema(response, OperationDetailsSchema);
};

export const getOperationById = cache(getOperationByIdUncached);
