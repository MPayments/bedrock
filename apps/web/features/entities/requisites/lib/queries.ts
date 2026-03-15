import { cache } from "react";
import { z } from "zod";

import { CounterpartyOptionsResponseSchema } from "@bedrock/parties/contracts";
import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import { OrganizationOptionsResponseSchema } from "@bedrock/organizations/contracts";
import { REQUISITES_LIST_CONTRACT } from "@bedrock/requisites/contracts";
import { RequisiteProviderOptionsResponseSchema } from "@bedrock/requisites/providers/contracts";

import {
  getRequisiteKindLabel,
  resolveRequisiteIdentity,
  type RequisiteKind,
  type SerializedRequisite,
} from "@/features/entities/requisites-shared/lib/constants";
import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import {
  readEntityById,
  readOptionsList,
  readPaginatedList,
} from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type {
  RequisitesFilterOptions,
  RequisitesListResult,
} from "./types";
import type { RequisitesSearchParams } from "./validations";

const RequisiteApiSchema = z.object({
  id: z.uuid(),
  ownerType: z.enum(["organization", "counterparty"]),
  ownerId: z.uuid(),
  providerId: z.uuid(),
  currencyId: z.uuid(),
  kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
  label: z.string(),
  accountNo: z.string().nullable(),
  iban: z.string().nullable(),
  swift: z.string().nullable(),
  bic: z.string().nullable(),
  address: z.string().nullable(),
  accountRef: z.string().nullable(),
  subaccountRef: z.string().nullable(),
  institutionName: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const RequisitesResponseSchema = createPaginatedResponseSchema(RequisiteApiSchema);

const RequisiteSummarySchema = z.object({
  id: z.uuid(),
  ownerType: z.enum(["organization", "counterparty"]),
  ownerId: z.uuid(),
  label: z.string(),
});

function createListQuery(search: RequisitesSearchParams) {
  return createResourceListQuery(REQUISITES_LIST_CONTRACT, search);
}

const getOwnerLabelMaps = cache(async () => {
  const client = await getServerApiClient();
  const [counterparties, organizations] = await Promise.all([
    readOptionsList({
      request: () =>
        client.v1.counterparties.options.$get({}, { init: { cache: "force-cache" } }),
      schema: CounterpartyOptionsResponseSchema,
      context: "Не удалось загрузить контрагентов",
    }),
    readOptionsList({
      request: () =>
        client.v1.organizations.options.$get({}, { init: { cache: "force-cache" } }),
      schema: OrganizationOptionsResponseSchema,
      context: "Не удалось загрузить организации",
    }),
  ]);

  return new Map(
    [
      ...counterparties.data.map((item) => [item.id, item.label] as const),
      ...organizations.data.map((item) => [item.id, item.label] as const),
    ],
  );
});

const getProviderOptions = cache(async () => {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1["requisite-providers"].options.$get(
        {},
        { init: { cache: "force-cache" } },
      ),
    schema: RequisiteProviderOptionsResponseSchema,
    context: "Не удалось загрузить провайдеров реквизитов",
  });

  return payload.data
    .map((item) => ({ value: item.id, label: item.label }))
    .sort((left, right) => left.label.localeCompare(right.label));
});

const getProviderLabelById = cache(async () => {
  return new Map(
    (await getProviderOptions()).map((item) => [item.value, item.label] as const),
  );
});

const getCurrencyOptions = cache(async () => {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.currencies.options.$get({}, { init: { cache: "force-cache" } }),
    schema: CurrencyOptionsResponseSchema,
    context: "Не удалось загрузить валюты",
  });

  return payload.data
    .map((item) => ({ value: item.id, label: item.label }))
    .sort((left, right) => left.label.localeCompare(right.label));
});

const getCurrencyLabelById = cache(async () => {
  return new Map(
    (await getCurrencyOptions()).map((item) => [item.value, item.label] as const),
  );
});

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
    identity: resolveRequisiteIdentity({
      kind: row.kind,
      accountNo: row.accountNo ?? "",
      iban: row.iban ?? "",
      swift: row.swift ?? "",
      bic: row.bic ?? "",
      address: row.address ?? "",
      accountRef: row.accountRef ?? "",
      subaccountRef: row.subaccountRef ?? "",
      institutionName: row.institutionName ?? "",
    }),
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const getRequisitesFilterOptions = cache(
  async (): Promise<RequisitesFilterOptions> => {
    const [providerOptions, currencyOptions] = await Promise.all([
      getProviderOptions(),
      getCurrencyOptions(),
    ]);

    return {
      providerOptions,
      currencyOptions,
    };
  },
);

export async function getRequisites(
  search: RequisitesSearchParams = {},
): Promise<RequisitesListResult> {
  const client = await getServerApiClient();
  const [{ data }, ownerLabelById, providerLabelById, currencyLabelById] =
    await Promise.all([
      readPaginatedList({
        request: () =>
          client.v1.requisites.$get({
            query: createListQuery(search),
          }),
        schema: RequisitesResponseSchema,
        context: "Не удалось загрузить реквизиты",
      }),
      getOwnerLabelMaps(),
      getProviderLabelById(),
      getCurrencyLabelById(),
    ]);

  return {
    ...data,
    data: data.data.map((row) =>
      serializeRow(row, ownerLabelById, providerLabelById, currencyLabelById),
    ),
  };
}

const getRequisiteByIdUncached = async (id: string) => {
  return readEntityById({
    id,
    resourceName: "реквизит",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.requisites[":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: RequisiteSummarySchema,
  });
};

export const getRequisiteById = cache(getRequisiteByIdUncached);
