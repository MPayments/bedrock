import { cache } from "react";
import { z } from "zod";

import { REQUISITE_PROVIDERS_LIST_CONTRACT } from "@bedrock/parties/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type {
  RequisiteProvidersListResult,
  SerializedRequisiteProvider,
} from "./types";
import type { RequisiteProvidersSearchParams } from "./validations";
import { serializeLegacyProvider } from "./master-data";

const LocaleTextMapSchema = z.record(z.string(), z.string().nullable()).nullable();

const RequisiteProviderListItemApiSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
  legalName: z.string(),
  legalNameI18n: LocaleTextMapSchema,
  displayName: z.string(),
  displayNameI18n: LocaleTextMapSchema,
  description: z.string().nullable(),
  country: z.string().nullable(),
  website: z.string().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const RequisiteProviderApiSchema = RequisiteProviderListItemApiSchema.extend({
  identifiers: z.array(
    z.object({
      scheme: z.string(),
      value: z.string(),
      isPrimary: z.boolean(),
    }),
  ),
  branches: z.array(
    z.object({
      id: z.uuid(),
      code: z.string().nullable(),
      name: z.string(),
      nameI18n: LocaleTextMapSchema,
      country: z.string().nullable(),
      rawAddress: z.string().nullable(),
      rawAddressI18n: LocaleTextMapSchema,
      line1: z.string().nullable(),
      line1I18n: LocaleTextMapSchema,
      line2: z.string().nullable(),
      line2I18n: LocaleTextMapSchema,
      city: z.string().nullable(),
      cityI18n: LocaleTextMapSchema,
      postalCode: z.string().nullable(),
      contactEmail: z.string().nullable(),
      contactPhone: z.string().nullable(),
      isPrimary: z.boolean(),
      identifiers: z.array(
        z.object({
          scheme: z.string(),
          value: z.string(),
          isPrimary: z.boolean(),
        }),
      ),
    }),
  ),
});

export type RequisiteProviderDetails = z.infer<typeof RequisiteProviderApiSchema>;

const RequisiteProvidersResponseSchema = createPaginatedResponseSchema(
  RequisiteProviderListItemApiSchema,
);

function serializeProvider(
  row: z.infer<typeof RequisiteProviderApiSchema>,
): SerializedRequisiteProvider {
  return serializeLegacyProvider(row);
}

function serializeProviderListItem(
  row: z.infer<typeof RequisiteProviderListItemApiSchema>,
): SerializedRequisiteProvider {
  return {
    id: row.id,
    kind: row.kind,
    name: row.displayName,
    legalName: row.legalName,
    displayName: row.displayName,
    description: row.description ?? "",
    country: row.country ?? "",
    address: "",
    contact: "",
    bic: "",
    swift: "",
    website: row.website,
    primaryBranchId: null,
    primaryBranchName: null,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
      client.v1.requisites.providers.$get({
        query: createListQuery(search),
      }),
    schema: RequisiteProvidersResponseSchema,
    context: "Не удалось загрузить провайдеров реквизитов",
  });

  return {
    ...data,
    data: data.data.map(serializeProviderListItem),
  };
}

const getRequisiteProviderByIdUncached = async (
  id: string,
): Promise<RequisiteProviderDetails | null> => {
  return readEntityById({
    id,
    resourceName: "провайдера реквизитов",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.requisites.providers[":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: RequisiteProviderApiSchema,
  });
};

export const getRequisiteProviderById = cache(getRequisiteProviderByIdUncached);
