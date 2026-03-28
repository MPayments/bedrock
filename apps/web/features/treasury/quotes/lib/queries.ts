import { z } from "zod";

import {
  QUOTES_LIST_CONTRACT,
  QuoteDetailsResponseSchema as FxQuoteDetailsResponseContractSchema,
  QuoteListItemSchema as FxQuoteListItemContractSchema,
} from "@bedrock/treasury/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readPaginatedList } from "@/lib/api/query";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { FxQuotesSearchParams } from "./validations";

const QuoteListItemSchema = FxQuoteListItemContractSchema.extend({
  createdAt: z.coerce.date(),
  usedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date(),
});

const FxQuoteDetailsResponseSchema = FxQuoteDetailsResponseContractSchema.extend({
  quote: FxQuoteDetailsResponseContractSchema.shape.quote.extend({
    createdAt: z.coerce.date(),
    usedAt: z.coerce.date().nullable(),
    expiresAt: z.coerce.date(),
  }),
  legs: z.array(
    FxQuoteDetailsResponseContractSchema.shape.legs.element.extend({
      asOf: z.coerce.date(),
      createdAt: z.coerce.date(),
    }),
  ),
});

const FxQuotesListResponseSchema = createPaginatedResponseSchema(
  QuoteListItemSchema,
);

function createFxQuotesListQuery(search: FxQuotesSearchParams) {
  return createResourceListQuery(QUOTES_LIST_CONTRACT, search);
}

export type FxQuoteListItem = z.infer<typeof QuoteListItemSchema>;
export type FxQuoteDetailsResult = z.infer<typeof FxQuoteDetailsResponseSchema>;
export type FxQuotesListResult = z.infer<typeof FxQuotesListResponseSchema>;

export async function getFxQuotes(
  search: FxQuotesSearchParams,
): Promise<FxQuotesListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.treasury.quotes.$get({
        query: createFxQuotesListQuery(search),
      }),
    schema: FxQuotesListResponseSchema,
    context: "Не удалось загрузить FX котировки",
  });

  return data;
}

export async function getFxQuoteDetails(
  quoteRef: string,
): Promise<FxQuoteDetailsResult | null> {
  const client = await getServerApiClient();
  const response = await client.v1.treasury.quotes[":quoteRef"].$get({
    param: { quoteRef },
  });

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить FX котировку");
  return readJsonWithSchema(response, FxQuoteDetailsResponseSchema);
}
