import { cache } from "react";
import { z } from "zod";

import { ORGANIZATIONS_LIST_CONTRACT } from "@bedrock/parties/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { OrganizationsListResult, SerializedOrganization } from "./types";
import type { OrganizationsSearchParams } from "./validations";

const OrganizationApiSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  kind: z.enum(["legal_entity", "individual"]),
  legalEntity: z.any().nullable(),
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

function createOrganizationsListQuery(search: OrganizationsSearchParams) {
  return createResourceListQuery(ORGANIZATIONS_LIST_CONTRACT, search);
}

export async function getOrganizations(
  search: OrganizationsSearchParams = {},
): Promise<OrganizationsListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.organizations.$get(
        {
          query: createOrganizationsListQuery(search),
        },
        { init: { cache: "no-store" } },
      ),
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
