import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { ACCOUNTING_OPERATIONS_LIST_CONTRACT } from "@multihansa/accounting/contracts";

import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { requestOk, readJsonWithSchema } from "@/lib/api/response";
import { isUuid } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

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

const OperationDetailsSchema = z.object({
  operation: OperationSummarySchema,
  postings: z.array(OperationPostingSchema),
  tbPlans: z.array(OperationTbPlanSchema),
  dimensionLabels: z.record(z.string(), z.string()),
});

const OperationsListResponseSchema = createPaginatedResponseSchema(
  OperationSummarySchema,
);

export type OperationSummaryDto = z.infer<typeof OperationSummarySchema>;
type OperationDetailsDto = z.infer<typeof OperationDetailsSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

async function fetchApi(path: string) {
  const requestHeaders = await headers();

  return fetch(`${API_URL}${path}`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
    },
    cache: "no-store",
  });
}

function createOperationsListQuery(search: OperationsSearchParams) {
  return createResourceListQuery(ACCOUNTING_OPERATIONS_LIST_CONTRACT, search);
}

export async function getOperations(
  search: OperationsSearchParams,
): Promise<z.infer<typeof OperationsListResponseSchema>> {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(createOperationsListQuery(search))) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, String(item));
      }
      continue;
    }

    query.set(key, String(value));
  }

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
