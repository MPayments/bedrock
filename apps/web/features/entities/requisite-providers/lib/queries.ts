import { cache } from "react";
import { z } from "zod";

import { REQUISITE_PROVIDERS_LIST_CONTRACT } from "@bedrock/requisites/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type {
  RequisiteProvidersListResult,
  SerializedRequisiteProvider,
} from "./types";
import type { RequisiteProvidersSearchParams } from "./validations";

const RequisiteProviderApiSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
  name: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  address: z.string().nullable(),
  contact: z.string().nullable(),
  bic: z.string().nullable(),
  swift: z.string().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const RequisiteProvidersResponseSchema = createPaginatedResponseSchema(
  RequisiteProviderApiSchema,
);

function serializeProvider(
  row: z.infer<typeof RequisiteProviderApiSchema>,
): SerializedRequisiteProvider {
  return row;
}

function createListQuery(search: RequisiteProvidersSearchParams) {
  return createResourceListQuery(REQUISITE_PROVIDERS_LIST_CONTRACT, search);
}

export async function getRequisiteProviders(
  search: RequisiteProvidersSearchParams = {},
): Promise<RequisiteProvidersListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1["requisite-providers"].$get({
        query: createListQuery(search),
      }),
    schema: RequisiteProvidersResponseSchema,
    context: "Не удалось загрузить провайдеров реквизитов",
  });

  return {
    ...data,
    data: data.data.map(serializeProvider),
  };
}

const getRequisiteProviderByIdUncached = async (
  id: string,
): Promise<SerializedRequisiteProvider | null> => {
  return readEntityById({
    id,
    resourceName: "провайдера реквизитов",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1["requisite-providers"][":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: RequisiteProviderApiSchema.transform(serializeProvider),
  });
};

export const getRequisiteProviderById = cache(getRequisiteProviderByIdUncached);
