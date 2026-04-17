import {
  CurrencyOptionsResponseSchema,
} from "@bedrock/currencies/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import {
  RateHistoryResponseSchema,
  RatePairsResponseSchema,
  RateSourceStatusesResponseSchema,
} from "@bedrock/treasury/contracts";
import { z } from "zod";

import { getServerApiClient } from "@/lib/api/server-client";
import { readOptionsList } from "@/lib/api/query";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";

const LatestRateResponseSchema = z.object({
  asOf: z.iso.datetime(),
  base: z.string(),
  quote: z.string(),
  rateDen: z.string(),
  rateNum: z.string(),
  source: z.string(),
});

export type SerializedRatePair = z.infer<
  typeof RatePairsResponseSchema.shape.data.element
>;
export type SerializedSourceRate = SerializedRatePair["rates"][number];
export type SerializedSourceStatus = z.infer<
  typeof RateSourceStatusesResponseSchema.shape.data.element
>;
export type SerializedRateHistoryPoint = z.infer<
  typeof RateHistoryResponseSchema.shape.data.element
>;
export type SerializedLatestRate = z.infer<typeof LatestRateResponseSchema>;
export type CurrencyOption = Pick<
  z.infer<typeof CurrencyOptionsResponseSchema.shape.data.element>,
  "code" | "name"
>;

export async function getRatePairs(): Promise<SerializedRatePair[]> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.treasury.rates.pairs.$get(),
    "Не удалось загрузить валютные пары",
  );

  const payload = await readJsonWithSchema(response, RatePairsResponseSchema);
  return payload.data;
}

export async function getRateSources(): Promise<SerializedSourceStatus[]> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.treasury.rates.sources.$get(),
    "Не удалось загрузить источники курсов",
  );

  const payload = await readJsonWithSchema(
    response,
    RateSourceStatusesResponseSchema,
  );
  return payload.data;
}

export async function getRateHistory(
  base: string,
  quote: string,
  from?: string,
): Promise<SerializedRateHistoryPoint[]> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.treasury.rates.history.$get({
      query: { base, quote, limit: MAX_QUERY_LIST_LIMIT, ...(from ? { from } : {}) },
    }),
    "Не удалось загрузить историю курсов",
  );

  const payload = await readJsonWithSchema(
    response,
    RateHistoryResponseSchema,
  );
  return payload.data;
}

export async function getCurrencyOptions(): Promise<CurrencyOption[]> {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.currencies.options.$get(
        {},
        { init: { cache: "force-cache" } },
      ),
    schema: CurrencyOptionsResponseSchema,
    context: "Не удалось загрузить валюты",
  });

  return payload.data.map((currency) => ({
    code: currency.code,
    name: currency.name,
  }));
}

export async function getLatestRate(
  base: string,
  quote: string,
  asOf?: string,
): Promise<SerializedLatestRate> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.treasury.rates.latest.$get({
      query: {
        base,
        quote,
        ...(asOf ? { asOf } : {}),
      },
    }),
    "Не удалось загрузить последний валютный курс",
  );

  return readJsonWithSchema(response, LatestRateResponseSchema);
}
