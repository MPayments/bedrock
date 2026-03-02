import { cache } from "react";
import { z } from "zod";

import { ACCOUNTING_OPERATIONS_LIST_CONTRACT } from "@bedrock/core/accounting/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readPaginatedList } from "@/lib/api/query";
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
  amountMinor: z.string(),
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
export type OperationDetailsDto = z.infer<typeof OperationDetailsSchema>;

function createOperationsListQuery(search: OperationsSearchParams) {
  return createResourceListQuery(ACCOUNTING_OPERATIONS_LIST_CONTRACT, search);
}

export async function getOperations(
  search: OperationsSearchParams,
): Promise<z.infer<typeof OperationsListResponseSchema>> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.accounting.operations.$get({
        query: createOperationsListQuery(search),
      }),
    schema: OperationsListResponseSchema,
    context: "Не удалось загрузить операции",
  });

  return data;
}

const getOperationByIdUncached = async (
  operationId: string,
): Promise<OperationDetailsDto | null> => {
  if (!isUuid(operationId)) {
    return null;
  }

  const client = await getServerApiClient();
  const response = await client.v1.accounting.operations[":operationId"].$get(
    { param: { operationId } },
    { init: { cache: "no-store" } },
  );

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить детали операции");
  return readJsonWithSchema(response, OperationDetailsSchema);
};

export const getOperationById = cache(getOperationByIdUncached);
