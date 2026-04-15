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

const FinanceCalculationLineSchema = z
  .object({
    amountMinor: z.string(),
    classification: z.string().nullable(),
    componentCode: z.string().nullable(),
    componentFamily: z.string().nullable(),
    currencyId: z.string().uuid(),
    idx: z.number().int().nonnegative(),
    kind: z.string(),
    routeLegId: z.string().uuid().nullable(),
    sourceKind: z.string(),
  })
  .passthrough();

const FinanceCalculationSnapshotSchema = z
  .object({
    baseCurrencyId: z.string().uuid(),
    calculationCurrencyId: z.string().uuid(),
    calculationTimestamp: ApiDateTimeStringSchema,
    expenseAmountInBaseMinor: z.string(),
    grossRevenueInBaseMinor: z.string(),
    id: z.string().uuid(),
    netMarginInBaseMinor: z.string(),
    passThroughAmountInBaseMinor: z.string(),
    rateDen: z.string(),
    rateNum: z.string(),
    rateSource: z.string(),
    routeVersionId: z.string().uuid().nullable(),
    snapshotNumber: z.number().int().positive(),
    state: z.string(),
    totalAmountMinor: z.string(),
    totalInBaseMinor: z.string(),
    totalWithExpensesInBaseMinor: z.string(),
  })
  .passthrough();

const FinanceCalculationDetailsSchema = z
  .object({
    createdAt: ApiDateTimeStringSchema,
    currentSnapshot: FinanceCalculationSnapshotSchema,
    id: z.string().uuid(),
    isActive: z.boolean(),
    lines: z.array(FinanceCalculationLineSchema),
    updatedAt: ApiDateTimeStringSchema,
  })
  .passthrough();

const FinanceCalculationAmountDeltaSchema = z.object({
  deltaMinor: z.string(),
  leftMinor: z.string(),
  rightMinor: z.string(),
});

const FinanceCalculationCompareLineSchema = z.object({
  classification: z.string().nullable(),
  componentCode: z.string(),
  componentFamily: z.string().nullable(),
  currencyId: z.string().uuid(),
  deltaAmountMinor: z.string(),
  kind: z.string(),
  leftAmountMinor: z.string(),
  rightAmountMinor: z.string(),
  routeLegId: z.string().uuid().nullable(),
});

const FinanceCalculationCompareSchema = z.object({
  left: FinanceCalculationDetailsSchema,
  lineDiffs: z.array(FinanceCalculationCompareLineSchema),
  right: FinanceCalculationDetailsSchema,
  totals: z.object({
    expenseAmountInBaseMinor: FinanceCalculationAmountDeltaSchema,
    grossRevenueInBaseMinor: FinanceCalculationAmountDeltaSchema,
    netMarginInBaseMinor: FinanceCalculationAmountDeltaSchema,
    passThroughAmountInBaseMinor: FinanceCalculationAmountDeltaSchema,
    totalInBaseMinor: FinanceCalculationAmountDeltaSchema,
    totalWithExpensesInBaseMinor: FinanceCalculationAmountDeltaSchema,
  }),
});

const FinanceDealCalculationWorkspaceSchema = z.object({
  comparison: FinanceCalculationCompareSchema.nullable(),
  currentCalculation: FinanceCalculationDetailsSchema.nullable(),
  currencies: CurrencyOptionsResponseSchema.shape.data,
  deal: z.unknown().transform((value) => value as FinanceDealWorkbench),
});

export type FinanceCalculationLine = z.infer<typeof FinanceCalculationLineSchema>;
export type FinanceCalculationSnapshot = z.infer<
  typeof FinanceCalculationSnapshotSchema
>;
export type FinanceCalculationDetails = z.infer<
  typeof FinanceCalculationDetailsSchema
>;
export type FinanceCalculationCompareLine = z.infer<
  typeof FinanceCalculationCompareLineSchema
>;
export type FinanceCalculationCompare = z.infer<
  typeof FinanceCalculationCompareSchema
>;
export type FinanceDealCalculationWorkspace = z.infer<
  typeof FinanceDealCalculationWorkspaceSchema
>;

async function readOptionalJson<TSchema extends z.ZodTypeAny>(
  path: string,
  schema: TSchema,
): Promise<z.infer<TSchema> | null> {
  try {
    const response = await fetchApi(path);

    if (!response.ok) {
      return null;
    }

    return await readJsonWithSchema(response, schema);
  } catch {
    return null;
  }
}

const getFinanceDealCalculationWorkspaceByIdUncached = async (
  id: string,
): Promise<FinanceDealCalculationWorkspace | null> => {
  const deal = await getFinanceDealWorkbenchById(id);

  if (!deal) {
    return null;
  }

  const currentCalculationId =
    deal.summary.calculationId ?? deal.calculationHistory[0]?.calculationId ?? null;

  const [currenciesResponse, currentCalculation, comparison] = await Promise.all([
    fetchApi("/v1/currencies/options"),
    currentCalculationId
      ? readOptionalJson(
          `/v1/deals/${encodeURIComponent(id)}/calculations/${encodeURIComponent(
            currentCalculationId,
          )}`,
          FinanceCalculationDetailsSchema,
        )
      : Promise.resolve(null),
    readOptionalJson(
      `/v1/deals/${encodeURIComponent(id)}/calculations/compare`,
      FinanceCalculationCompareSchema,
    ),
  ]);

  await requestOk(currenciesResponse, "Не удалось загрузить валюты");
  const currencies = await readJsonWithSchema(
    currenciesResponse,
    CurrencyOptionsResponseSchema,
  ).then((payload) => payload.data);

  return FinanceDealCalculationWorkspaceSchema.parse({
    comparison,
    currentCalculation,
    currencies,
    deal,
  });
};

export const getFinanceDealCalculationWorkspaceById = cache(
  getFinanceDealCalculationWorkspaceByIdUncached,
);
