import { cache } from "react";
import { z } from "zod";

import {
  CounterpartyListItemSchema,
  CounterpartyGroupOptionsResponseSchema,
  CounterpartySchema,
  type CounterpartyGroupOption,
} from "@bedrock/parties/contracts";
import { COUNTERPARTIES_LIST_CONTRACT } from "@bedrock/parties/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import {
  readEntityById,
  readOptionsList,
  readPaginatedList,
} from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { CounterpartiesListResult } from "./types";
import { type CounterpartiesSearchParams } from "./validations";

const CounterpartyListItemResponseSchema = CounterpartyListItemSchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const CounterpartyResponseSchema = CounterpartySchema.omit({
  createdAt: true,
  updatedAt: true,
}).extend({
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const CounterpartiesListResponseSchema = createPaginatedResponseSchema(
  CounterpartyListItemResponseSchema,
);

function createCounterpartiesListQuery(search: CounterpartiesSearchParams) {
  return createResourceListQuery(COUNTERPARTIES_LIST_CONTRACT, search);
}

export async function getCounterparties(
  search: CounterpartiesSearchParams,
): Promise<CounterpartiesListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.counterparties.$get(
        {
          query: createCounterpartiesListQuery(search),
        },
        {
          init: { cache: "no-store" },
        },
      ),
    schema: CounterpartiesListResponseSchema,
    context: "Не удалось загрузить контрагентов",
  });

  return data;
}

export type CounterpartyDetails = z.infer<typeof CounterpartyResponseSchema>;
export type { CounterpartyGroupOption };
const getCounterpartyByIdUncached = async (
  id: string,
): Promise<CounterpartyDetails | null> => {
  return readEntityById({
    id,
    resourceName: "контрагента",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.counterparties[":id"].$get(
        {
          param: { id: validId },
        },
        {
          init: { cache: "no-store" },
        },
      );
    },
    schema: CounterpartyResponseSchema,
  });
};

export const getCounterpartyById = cache(getCounterpartyByIdUncached);

export async function getCounterpartyGroups(): Promise<
  CounterpartyGroupOption[]
> {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1["counterparty-groups"].options.$get(
        {},
        {
          init: { cache: "force-cache" },
        },
      ),
    schema: CounterpartyGroupOptionsResponseSchema,
    context: "Не удалось загрузить группы контрагентов",
  });

  return payload.data;
}
