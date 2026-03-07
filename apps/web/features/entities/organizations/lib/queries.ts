import { cache } from "react";
import { z } from "zod";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readPaginatedList } from "@/lib/api/query";

import type { OrganizationsListResult, SerializedOrganization } from "./types";

const OrganizationApiSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  kind: z.enum(["legal_entity", "individual"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const OrganizationsResponseSchema = createPaginatedResponseSchema(
  OrganizationApiSchema,
);

function serializeOrganization(
  row: z.infer<typeof OrganizationApiSchema>,
): SerializedOrganization {
  return row;
}

export async function getOrganizations(): Promise<OrganizationsListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.organizations.$get({
        query: {
          limit: 200,
          offset: 0,
          sortBy: "updatedAt",
          sortOrder: "desc",
        },
      }),
    schema: OrganizationsResponseSchema,
    context: "Не удалось загрузить организации",
  });

  return {
    ...data,
    data: data.data.map(serializeOrganization),
  };
}

const getOrganizationByIdUncached = async (
  id: string,
): Promise<SerializedOrganization | null> => {
  return readEntityById({
    id,
    resourceName: "организацию",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.organizations[":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: OrganizationApiSchema.transform(serializeOrganization),
  });
};

export const getOrganizationById = cache(getOrganizationByIdUncached);
