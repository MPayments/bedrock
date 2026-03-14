import { z } from "zod";

import {
  FX_QUOTES_LIST_CONTRACT,
  FxQuoteListItemSchema as FxQuoteListItemContractSchema,
} from "@bedrock/fx/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { FxQuotesSearchParams } from "./validations";

const FxQuoteListItemSchema = FxQuoteListItemContractSchema.extend({
  createdAt: z.coerce.date(),
  usedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date(),
});

const FxQuotesListResponseSchema = createPaginatedResponseSchema(
  FxQuoteListItemSchema,
);

function createFxQuotesListQuery(search: FxQuotesSearchParams) {
  return createResourceListQuery(FX_QUOTES_LIST_CONTRACT, search);
}

export type FxQuoteListItem = z.infer<typeof FxQuoteListItemSchema>;
export type FxQuotesListResult = z.infer<typeof FxQuotesListResponseSchema>;

export async function getFxQuotes(
  search: FxQuotesSearchParams,
): Promise<FxQuotesListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.fx.quotes.$get({
        query: createFxQuotesListQuery(search),
      }),
    schema: FxQuotesListResponseSchema,
    context: "Не удалось загрузить FX котировки",
  });

  return data;
}
