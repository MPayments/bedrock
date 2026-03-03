import { cache } from "react";
import { z } from "zod";

import { COUNTERPARTY_ACCOUNT_PROVIDERS_LIST_CONTRACT } from "@bedrock/core/counterparty-accounts/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { ProvidersListResult } from "./types";
import type { ProvidersSearchParams } from "./validations";

const ProviderResponseSchema = z.object({
  id: z.uuid(),
  type: z.enum(["bank", "exchange", "blockchain", "custodian"]),
  name: z.string(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  contact: z.string().nullable(),
  bic: z.string().nullable(),
  swift: z.string().nullable(),
  country: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const ProvidersListResponseSchema = createPaginatedResponseSchema(
  ProviderResponseSchema,
);

function createProvidersListQuery(search: ProvidersSearchParams) {
  return createResourceListQuery(COUNTERPARTY_ACCOUNT_PROVIDERS_LIST_CONTRACT, search);
}

export async function getProviders(
  search: ProvidersSearchParams,
): Promise<ProvidersListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1["counterparty-account-providers"].$get({
        query: createProvidersListQuery(search),
      }),
    schema: ProvidersListResponseSchema,
    context: "Не удалось загрузить провайдеров",
  });

  return data;
}

export type ProviderDetails = z.infer<typeof ProviderResponseSchema>;

const getProviderByIdUncached = async (
  id: string,
): Promise<ProviderDetails | null> => {
  return readEntityById({
    id,
    resourceName: "провайдера",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1["counterparty-account-providers"][":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: ProviderResponseSchema,
  });
};

export const getProviderById = cache(getProviderByIdUncached);
