import {
  CurrencyOptionsResponseSchema,
} from "@bedrock/currencies/contracts";
import {
  FxRatePairsResponseSchema,
  FxRateSourceStatusesResponseSchema,
} from "@bedrock/fx/contracts";
import { z } from "zod";

import { getServerApiClient } from "@/lib/api/server-client";
import { readOptionsList } from "@/lib/api/query";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";

export type SerializedRatePair = z.infer<
  typeof FxRatePairsResponseSchema.shape.data.element
>;
export type SerializedSourceRate = SerializedRatePair["rates"][number];
export type SerializedSourceStatus = z.infer<
  typeof FxRateSourceStatusesResponseSchema.shape.data.element
>;
export type CurrencyOption = Pick<
  z.infer<typeof CurrencyOptionsResponseSchema.shape.data.element>,
  "code" | "name"
>;

export async function getRatePairs(): Promise<SerializedRatePair[]> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.fx.rates.pairs.$get(),
    "Не удалось загрузить валютные пары",
  );

  const payload = await readJsonWithSchema(response, FxRatePairsResponseSchema);
  return payload.data;
}

export async function getRateSources(): Promise<SerializedSourceStatus[]> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.fx.rates.sources.$get(),
    "Не удалось загрузить источники курсов",
  );

  const payload = await readJsonWithSchema(
    response,
    FxRateSourceStatusesResponseSchema,
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
