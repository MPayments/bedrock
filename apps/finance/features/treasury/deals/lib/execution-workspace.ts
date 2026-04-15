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
const JsonRecordSchema = z.record(z.string(), z.unknown());
const FinanceExecutionActualSourceKindSchema = z.enum([
  "manual",
  "provider",
  "reconciliation",
  "system",
]);

const FinanceExecutionFillSchema = z.object({
  actualRateDen: z.string().nullable(),
  actualRateNum: z.string().nullable(),
  boughtAmountMinor: z.string().nullable(),
  boughtCurrencyId: z.string().uuid().nullable(),
  calculationSnapshotId: z.string().uuid().nullable(),
  confirmedAt: ApiDateTimeStringSchema.nullable(),
  createdAt: ApiDateTimeStringSchema,
  dealId: z.string().uuid().nullable(),
  executedAt: ApiDateTimeStringSchema,
  externalRecordId: z.string().nullable(),
  fillSequence: z.number().int().positive().nullable(),
  id: z.string().uuid(),
  instructionId: z.string().uuid().nullable(),
  metadata: JsonRecordSchema.nullable(),
  notes: z.string().nullable(),
  operationId: z.string().uuid(),
  providerCounterpartyId: z.string().uuid().nullable(),
  providerRef: z.string().nullable(),
  routeLegId: z.string().uuid().nullable(),
  routeVersionId: z.string().uuid().nullable(),
  soldAmountMinor: z.string().nullable(),
  soldCurrencyId: z.string().uuid().nullable(),
  sourceKind: FinanceExecutionActualSourceKindSchema,
  sourceRef: z.string(),
  updatedAt: ApiDateTimeStringSchema,
});

const FinanceExecutionFeeSchema = z.object({
  amountMinor: z.string().nullable(),
  calculationSnapshotId: z.string().uuid().nullable(),
  chargedAt: ApiDateTimeStringSchema,
  componentCode: z.string().nullable(),
  confirmedAt: ApiDateTimeStringSchema.nullable(),
  createdAt: ApiDateTimeStringSchema,
  currencyId: z.string().uuid().nullable(),
  dealId: z.string().uuid().nullable(),
  externalRecordId: z.string().nullable(),
  feeFamily: z.string(),
  fillId: z.string().uuid().nullable(),
  id: z.string().uuid(),
  instructionId: z.string().uuid().nullable(),
  metadata: JsonRecordSchema.nullable(),
  notes: z.string().nullable(),
  operationId: z.string().uuid(),
  providerCounterpartyId: z.string().uuid().nullable(),
  providerRef: z.string().nullable(),
  routeComponentId: z.string().uuid().nullable(),
  routeLegId: z.string().uuid().nullable(),
  routeVersionId: z.string().uuid().nullable(),
  sourceKind: FinanceExecutionActualSourceKindSchema,
  sourceRef: z.string(),
  updatedAt: ApiDateTimeStringSchema,
});

const FinanceCashMovementSchema = z.object({
  accountRef: z.string().nullable(),
  amountMinor: z.string().nullable(),
  bookedAt: ApiDateTimeStringSchema,
  calculationSnapshotId: z.string().uuid().nullable(),
  confirmedAt: ApiDateTimeStringSchema.nullable(),
  createdAt: ApiDateTimeStringSchema,
  currencyId: z.string().uuid().nullable(),
  dealId: z.string().uuid().nullable(),
  direction: z.enum(["credit", "debit"]),
  externalRecordId: z.string().nullable(),
  id: z.string().uuid(),
  instructionId: z.string().uuid().nullable(),
  metadata: JsonRecordSchema.nullable(),
  notes: z.string().nullable(),
  operationId: z.string().uuid(),
  providerCounterpartyId: z.string().uuid().nullable(),
  providerRef: z.string().nullable(),
  requisiteId: z.string().uuid().nullable(),
  routeLegId: z.string().uuid().nullable(),
  routeVersionId: z.string().uuid().nullable(),
  sourceKind: FinanceExecutionActualSourceKindSchema,
  sourceRef: z.string(),
  statementRef: z.string().nullable(),
  updatedAt: ApiDateTimeStringSchema,
  valueDate: ApiDateTimeStringSchema.nullable(),
});

const FinanceDealExecutionWorkspaceSchema = z.object({
  cashMovements: z.array(FinanceCashMovementSchema),
  currencies: CurrencyOptionsResponseSchema.shape.data,
  deal: z.unknown().transform((value) => value as FinanceDealWorkbench),
  fees: z.array(FinanceExecutionFeeSchema),
  fills: z.array(FinanceExecutionFillSchema),
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

async function readOptionalActualsList<TSchema extends z.ZodTypeAny>(input: {
  path: string;
  schema: TSchema;
}): Promise<z.infer<TSchema>[]> {
  try {
    const response = await fetchApi(input.path);

    if (!response.ok) {
      return [];
    }

    return await readJsonWithSchema(
      response,
      z.object({
        data: z.array(input.schema),
        limit: z.number().int().positive(),
        offset: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      }),
    ).then((payload) => payload.data);
  } catch {
    return [];
  }
}

async function readOptionalExecutionActuals(
  dealId: string,
): Promise<
  Pick<FinanceDealExecutionWorkspace, "cashMovements" | "fees" | "fills">
> {
  const fillsParams = new URLSearchParams({
    dealId,
    limit: "200",
    sortBy: "executedAt",
    sortOrder: "desc",
  });
  const feesParams = new URLSearchParams({
    dealId,
    limit: "200",
    sortBy: "chargedAt",
    sortOrder: "desc",
  });
  const cashMovementParams = new URLSearchParams({
    dealId,
    limit: "200",
    sortBy: "bookedAt",
    sortOrder: "desc",
  });

  const [fills, fees, cashMovements] = await Promise.all([
    readOptionalActualsList({
      path: `/v1/treasury/execution-fills?${fillsParams.toString()}`,
      schema: FinanceExecutionFillSchema,
    }),
    readOptionalActualsList({
      path: `/v1/treasury/execution-fees?${feesParams.toString()}`,
      schema: FinanceExecutionFeeSchema,
    }),
    readOptionalActualsList({
      path: `/v1/treasury/cash-movements?${cashMovementParams.toString()}`,
      schema: FinanceCashMovementSchema,
    }),
  ]);

  return {
    cashMovements,
    fees,
    fills,
  };
}

const getFinanceDealExecutionWorkspaceByIdUncached = async (
  id: string,
): Promise<FinanceDealExecutionWorkspace | null> => {
  const deal = await getFinanceDealWorkbenchById(id);

  if (!deal) {
    return null;
  }

  const [currenciesResponse, actuals] = await Promise.all([
    fetchApi("/v1/currencies/options"),
    readOptionalExecutionActuals(id),
  ]);

  await requestOk(currenciesResponse, "Не удалось загрузить валюты");
  const currencies = await readJsonWithSchema(
    currenciesResponse,
    CurrencyOptionsResponseSchema,
  ).then((payload) => payload.data);

  return FinanceDealExecutionWorkspaceSchema.parse({
    cashMovements: actuals.cashMovements,
    currencies,
    deal,
    fees: actuals.fees,
    fills: actuals.fills,
  });
};

export const getFinanceDealExecutionWorkspaceById = cache(
  getFinanceDealExecutionWorkspaceByIdUncached,
);
