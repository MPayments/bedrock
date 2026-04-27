import { z } from "zod";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import {
  OrganizationOptionsResponseSchema,
  RequisiteProviderOptionsResponseSchema,
} from "@bedrock/parties/contracts";

import {
  getRequisiteKindLabel,
  type RequisiteKind,
  type SerializedRequisite,
} from "@/features/entities/requisites-shared/lib/constants";
import {
  resolveLegacyRequisiteIdentity,
} from "@/features/entities/requisites-shared/lib/master-data";
import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import {
  readOptionsList,
  readPaginatedList,
} from "@/lib/api/query";

const RequisiteApiSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal("organization"),
  ownerId: z.uuid(),
  providerId: z.uuid(),
  providerBranchId: z.uuid().nullable(),
  currencyId: z.uuid(),
  kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
  label: z.string(),
  beneficiaryName: z.string().nullable(),
  beneficiaryNameLocal: z.string().nullable(),
  beneficiaryAddress: z.string().nullable(),
  paymentPurposeTemplate: z.string().nullable(),
  notes: z.string().nullable(),
  isDefault: z.boolean(),
  identifiers: z
    .array(
      z.object({
        scheme: z.string(),
        value: z.string(),
        isPrimary: z.boolean(),
      }),
    )
    .default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const RequisitesListResponseSchema = createPaginatedResponseSchema(
  RequisiteApiSchema,
);

async function getOrganizationLabelById() {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.organizations.options.$get(
        {},
        { init: { cache: "force-cache" } },
      ),
    schema: OrganizationOptionsResponseSchema,
    context: "Не удалось загрузить организации",
  });

  return new Map(payload.data.map((item) => [item.id, item.label]));
}

async function getProviderLabelById() {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.requisites.providers.options.$get(
        { query: {} },
        { init: { cache: "force-cache" } },
      ),
    schema: RequisiteProviderOptionsResponseSchema,
    context: "Не удалось загрузить провайдеров реквизитов",
  });

  return new Map(payload.data.map((item) => [item.id, item.label]));
}

async function getCurrencyLabelById() {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.currencies.options.$get({}, { init: { cache: "force-cache" } }),
    schema: CurrencyOptionsResponseSchema,
    context: "Не удалось загрузить валюты",
  });

  return new Map(payload.data.map((item) => [item.id, item.label]));
}

function serializeRow(
  row: z.infer<typeof RequisiteApiSchema>,
  ownerLabelById: ReadonlyMap<string, string>,
  providerLabelById: ReadonlyMap<string, string>,
  currencyLabelById: ReadonlyMap<string, string>,
): SerializedRequisite {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    ownerDisplay: ownerLabelById.get(row.ownerId) ?? "—",
    providerId: row.providerId,
    providerDisplay: providerLabelById.get(row.providerId) ?? "—",
    currencyId: row.currencyId,
    currencyDisplay: currencyLabelById.get(row.currencyId) ?? "—",
    kind: row.kind as RequisiteKind,
    kindDisplay: getRequisiteKindLabel(row.kind),
    label: row.label,
    identity: resolveLegacyRequisiteIdentity({
      kind: row.kind,
      label: row.label,
      beneficiaryName: row.beneficiaryName,
      identifiers: row.identifiers,
    }),
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getOrganizationRequisitesForOrganization(
  organizationId: string,
): Promise<SerializedRequisite[]> {
  const client = await getServerApiClient();
  const [{ data: payload }, ownerLabelById, providerLabelById, currencyLabelById] =
    await Promise.all([
      readPaginatedList({
        request: () =>
          client.v1.organizations[":id"].requisites.$get({
            param: { id: organizationId },
            query: {
              limit: 100,
              offset: 0,
              sortBy: "createdAt",
              sortOrder: "desc",
            },
          }),
        schema: RequisitesListResponseSchema,
        context: "Не удалось загрузить реквизиты организации",
      }),
      getOrganizationLabelById(),
      getProviderLabelById(),
      getCurrencyLabelById(),
    ]);

  return payload.data.map((row) =>
    serializeRow(row, ownerLabelById, providerLabelById, currencyLabelById),
  );
}
