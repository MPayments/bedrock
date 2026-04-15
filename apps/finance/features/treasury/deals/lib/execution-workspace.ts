import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";

import { readJsonWithSchema, requestOk } from "@/lib/api/response";

import {
  getFinanceDealWorkbenchById,
  type FinanceDealWorkbench,
} from "./queries";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";
const ApiDateTimeStringSchema = z.string().min(1);

const FinanceOperationFactSchema = z.object({
  amountMinor: z.string().nullable(),
  confirmedAt: ApiDateTimeStringSchema.nullable(),
  counterAmountMinor: z.string().nullable(),
  counterCurrencyId: z.string().uuid().nullable(),
  createdAt: ApiDateTimeStringSchema,
  currencyId: z.string().uuid().nullable(),
  dealId: z.string().uuid().nullable(),
  externalRecordId: z.string().nullable(),
  feeAmountMinor: z.string().nullable(),
  feeCurrencyId: z.string().uuid().nullable(),
  id: z.string().uuid(),
  instructionId: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  notes: z.string().nullable(),
  operationId: z.string().uuid(),
  providerRef: z.string().nullable(),
  recordedAt: ApiDateTimeStringSchema,
  routeLegId: z.string().uuid().nullable(),
  sourceKind: z.enum(["manual", "provider", "reconciliation", "system"]),
  sourceRef: z.string(),
  updatedAt: ApiDateTimeStringSchema,
});

const FinanceDealExecutionWorkspaceSchema = z.object({
  currencies: CurrencyOptionsResponseSchema.shape.data,
  deal: z.unknown().transform((value) => value as FinanceDealWorkbench),
  facts: z.array(FinanceOperationFactSchema),
});

export type FinanceDealExecutionWorkspace = z.infer<
  typeof FinanceDealExecutionWorkspaceSchema
>;

async function fetchApi(path: string) {
  const requestHeaders = await headers();

  return fetch(`${API_URL}${path}`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
      "x-bedrock-app-audience": "finance",
    },
    cache: "no-store",
  });
}

async function readOptionalFacts(
  dealId: string,
): Promise<FinanceDealExecutionWorkspace["facts"]> {
  try {
    const params = new URLSearchParams({
      dealId,
      limit: "200",
      sortBy: "recordedAt",
      sortOrder: "desc",
    });
    const response = await fetchApi(
      `/v1/treasury/operation-facts?${params.toString()}`,
    );

    if (!response.ok) {
      return [];
    }

    return await readJsonWithSchema(
      response,
      z.object({
        data: z.array(FinanceOperationFactSchema),
        limit: z.number().int().positive(),
        offset: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      }),
    ).then((payload) => payload.data);
  } catch {
    return [];
  }
}

const getFinanceDealExecutionWorkspaceByIdUncached = async (
  id: string,
): Promise<FinanceDealExecutionWorkspace | null> => {
  const deal = await getFinanceDealWorkbenchById(id);

  if (!deal) {
    return null;
  }

  const [currenciesResponse, facts] = await Promise.all([
    fetchApi("/v1/currencies/options"),
    readOptionalFacts(id),
  ]);

  await requestOk(currenciesResponse, "Не удалось загрузить валюты");
  const currencies = await readJsonWithSchema(
    currenciesResponse,
    CurrencyOptionsResponseSchema,
  ).then((payload) => payload.data);

  return FinanceDealExecutionWorkspaceSchema.parse({
    currencies,
    deal,
    facts,
  });
};

export const getFinanceDealExecutionWorkspaceById = cache(
  getFinanceDealExecutionWorkspaceByIdUncached,
);
