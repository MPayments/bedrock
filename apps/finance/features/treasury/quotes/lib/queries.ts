import { z } from "zod";

import {
  QUOTES_LIST_CONTRACT,
  QuoteListItemSchema as FxQuoteListItemContractSchema,
} from "@bedrock/treasury/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { FxQuotesSearchParams } from "./validations";

const QuoteListItemSchema = FxQuoteListItemContractSchema.extend({
  createdAt: z.coerce.date(),
  dealRef: z
    .object({
      applicantName: z.string().nullable(),
      dealId: z.string().uuid(),
      status: z.string(),
      type: z.enum([
        "payment",
        "currency_exchange",
        "currency_transit",
        "exporter_settlement",
      ]),
    })
    .nullable()
    .optional(),
  usedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date(),
});

const FxQuotesListResponseSchema = createPaginatedResponseSchema(
  QuoteListItemSchema,
);

function createFxQuotesListQuery(search: FxQuotesSearchParams) {
  return createResourceListQuery(QUOTES_LIST_CONTRACT, search);
}

export type FxQuoteListItem = z.infer<typeof QuoteListItemSchema>;
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
