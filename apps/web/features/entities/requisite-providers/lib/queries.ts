import { cache } from "react";
import { z } from "zod";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readPaginatedList } from "@/lib/api/query";

import type {
  RequisiteProvidersListResult,
  SerializedRequisiteProvider,
} from "./types";

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

export async function getRequisiteProviders(): Promise<RequisiteProvidersListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.parties["requisite-providers"].$get({
        query: {
          limit: 200,
          offset: 0,
          sortBy: "updatedAt",
          sortOrder: "desc",
        },
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
      return client.v1.parties["requisite-providers"][":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: RequisiteProviderApiSchema.transform(serializeProvider),
  });
};

export const getRequisiteProviderById = cache(getRequisiteProviderByIdUncached);
