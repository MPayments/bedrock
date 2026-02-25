import { cache } from "react";

import { ACCOUNTING_OPERATIONS_LIST_CONTRACT } from "@bedrock/accounting/validation";

import { getServerApiClient } from "@/lib/api-client.server";
import { isUuid } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { OperationsSearchParams } from "./validations";

export interface OperationSummaryDto {
  id: string;
  sourceType: string;
  sourceId: string;
  operationCode: string;
  operationVersion: number;
  postingDate: string;
  status: "pending" | "posted" | "failed";
  error: string | null;
  postedAt: string | null;
  outboxAttempts: number;
  lastOutboxErrorAt: string | null;
  createdAt: string;
  postingCount: number;
  bookOrgIds: string[];
  currencies: string[];
}

export interface OperationPostingDto {
  id: string;
  lineNo: number;
  bookOrgId: string;
  bookOrgName: string | null;
  debitBookAccountId: string;
  debitAccountNo: string | null;
  creditBookAccountId: string;
  creditAccountNo: string | null;
  postingCode: string;
  currency: string;
  amountMinor: string;
  memo: string | null;
  analyticCounterpartyId: string | null;
  analyticCustomerId: string | null;
  analyticOrderId: string | null;
  analyticOperationalAccountId: string | null;
  analyticTransferId: string | null;
  analyticQuoteId: string | null;
  analyticFeeBucket: string | null;
  createdAt: string;
}

export interface OperationTbPlanDto {
  id: string;
  lineNo: number;
  type: "create" | "post_pending" | "void_pending";
  transferId: string;
  debitTbAccountId: string | null;
  creditTbAccountId: string | null;
  tbLedger: number;
  amount: string;
  code: number;
  pendingRef: string | null;
  pendingId: string | null;
  isLinked: boolean;
  isPending: boolean;
  timeoutSeconds: number;
  status: "pending" | "posted" | "failed";
  error: string | null;
  createdAt: string;
}

export interface OperationDetailsDto {
  operation: OperationSummaryDto;
  postings: OperationPostingDto[];
  tbPlans: OperationTbPlanDto[];
}

export interface OperationsListResult {
  data: OperationSummaryDto[];
  total: number;
  limit: number;
  offset: number;
}

function createOperationsListQuery(search: OperationsSearchParams) {
  return createResourceListQuery(ACCOUNTING_OPERATIONS_LIST_CONTRACT, search);
}

export async function getOperations(
  search: OperationsSearchParams,
): Promise<OperationsListResult> {
  const client = await getServerApiClient();
  const res = await client.v1.accounting.operations.$get({
    query: createOperationsListQuery(search),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch operations: ${res.status}`);
  }

  return res.json() as Promise<OperationsListResult>;
}

const getOperationByIdUncached = async (
  operationId: string,
): Promise<OperationDetailsDto | null> => {
  if (!isUuid(operationId)) {
    return null;
  }

  const client = await getServerApiClient();
  const res = await client.v1.accounting.operations[":operationId"].$get(
    { param: { operationId } },
    { init: { cache: "no-store" } },
  );

  if (res.status === 404) {
    return null;
  }

  return (await res.json()) as OperationDetailsDto;
};

export const getOperationById = cache(getOperationByIdUncached);
