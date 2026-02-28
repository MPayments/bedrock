import { cache } from "react";

import { PROVIDERS_LIST_CONTRACT } from "@bedrock/operational-accounts/contracts";

import { getServerApiClient } from "@/lib/api-client.server";
import { readResourceById } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { ProvidersListResult } from "../(table)";
import type { ProvidersSearchParams } from "./validations";

function createProvidersListQuery(search: ProvidersSearchParams) {
  return createResourceListQuery(PROVIDERS_LIST_CONTRACT, search);
}

export async function getProviders(
  search: ProvidersSearchParams,
): Promise<ProvidersListResult> {
  const client = await getServerApiClient();
  const res = await client.v1["account-providers"].$get({
    query: createProvidersListQuery(search),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch providers: ${res.status}`);
  }

  return res.json() as Promise<ProvidersListResult>;
}

export interface ProviderDetails {
  id: string;
  type: string;
  name: string;
  description: string | null;
  address: string | null;
  contact: string | null;
  bic: string | null;
  swift: string | null;
  country: string;
  createdAt: string;
  updatedAt: string;
}

const getProviderByIdUncached = async (
  id: string,
): Promise<ProviderDetails | null> => {
  return readResourceById<ProviderDetails>({
    id,
    resourceName: "provider",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1["account-providers"][":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
  });
};

export const getProviderById = cache(getProviderByIdUncached);
