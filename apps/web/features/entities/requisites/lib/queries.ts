import { cache } from "react";
import { z } from "zod";

import { CounterpartyOptionsResponseSchema } from "@bedrock/parties/contracts";
import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import { OrganizationOptionsResponseSchema } from "@bedrock/organizations/contracts";
import { RequisiteProviderOptionsResponseSchema } from "@bedrock/requisites/contracts";

import {
  getRequisiteKindLabel,
  resolveRequisiteIdentity,
  type RelationOption,
  type RequisiteKind,
  type SerializedRequisite,
} from "@/features/entities/requisites-shared/lib/constants";
import { REQUISITES_LIST_CONTRACT } from "@/features/entities/requisites-shared/lib/contracts";
import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import {
  readEntityById,
  readOptionsList,
  readPaginatedList,
} from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type {
  RequisiteDetailsWithOwnerType,
  RequisiteFormOptions,
  RequisitesFilterOptions,
  RequisitesListResult,
} from "./types";
import type { RequisitesSearchParams } from "./validations";

const RequisiteListItemApiSchema = z.object({
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

const RequisiteDetailsApiSchema = z.object({
  id: z.uuid(),
  ownerType: z.enum(["organization", "counterparty"]),
  ownerId: z.uuid(),
  providerId: z.uuid(),
  currencyId: z.uuid(),
  kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
  label: z.string(),
  description: z.string().nullable(),
  beneficiaryName: z.string().nullable(),
  institutionName: z.string().nullable(),
  institutionCountry: z.string().nullable(),
  accountNo: z.string().nullable(),
  corrAccount: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  swift: z.string().nullable(),
  bankAddress: z.string().nullable(),
  network: z.string().nullable(),
  assetCode: z.string().nullable(),
  address: z.string().nullable(),
  memoTag: z.string().nullable(),
  accountRef: z.string().nullable(),
  subaccountRef: z.string().nullable(),
  contact: z.string().nullable(),
  notes: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const RequisitesResponseSchema = createPaginatedResponseSchema(
  RequisiteListItemApiSchema,
);

function createListQuery(search: RequisitesSearchParams) {
  return createResourceListQuery(REQUISITES_LIST_CONTRACT, search);
}

function toRelationOptions<TItem extends { id: string; label: string }>(
  items: TItem[],
): RelationOption[] {
  return items
    .map((item) => ({ id: item.id, label: item.label }))
    .sort((left, right) => left.label.localeCompare(right.label));
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
      client.v1.requisites.providers.options.$get(
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
  row: z.infer<typeof RequisiteListItemApiSchema>,
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

function serializeDetails(
  row: z.infer<typeof RequisiteDetailsApiSchema>,
): RequisiteDetailsWithOwnerType {
  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    providerId: row.providerId,
    currencyId: row.currencyId,
    kind: row.kind,
    label: row.label,
    description: row.description ?? "",
    beneficiaryName: row.beneficiaryName ?? "",
    institutionName: row.institutionName ?? "",
    institutionCountry: row.institutionCountry ?? "",
    accountNo: row.accountNo ?? "",
    corrAccount: row.corrAccount ?? "",
    iban: row.iban ?? "",
    bic: row.bic ?? "",
    swift: row.swift ?? "",
    bankAddress: row.bankAddress ?? "",
    network: row.network ?? "",
    assetCode: row.assetCode ?? "",
    address: row.address ?? "",
    memoTag: row.memoTag ?? "",
    accountRef: row.accountRef ?? "",
    subaccountRef: row.subaccountRef ?? "",
    contact: row.contact ?? "",
    notes: row.notes ?? "",
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

export const getRequisiteFormOptions = cache(
  async (): Promise<RequisiteFormOptions> => {
    const client = await getServerApiClient();
    const [counterparties, organizations, providers, currencies] =
      await Promise.all([
        readOptionsList({
          request: () =>
            client.v1.counterparties.options.$get(
              {},
              { init: { cache: "force-cache" } },
            ),
          schema: CounterpartyOptionsResponseSchema,
          context: "Не удалось загрузить контрагентов",
        }),
        readOptionsList({
          request: () =>
            client.v1.organizations.options.$get(
              {},
              { init: { cache: "force-cache" } },
            ),
          schema: OrganizationOptionsResponseSchema,
          context: "Не удалось загрузить организации",
        }),
        readOptionsList({
          request: () =>
            client.v1.requisites.providers.options.$get(
              {},
              { init: { cache: "force-cache" } },
            ),
          schema: RequisiteProviderOptionsResponseSchema,
          context: "Не удалось загрузить провайдеров реквизитов",
        }),
        readOptionsList({
          request: () =>
            client.v1.currencies.options.$get(
              {},
              { init: { cache: "force-cache" } },
            ),
          schema: CurrencyOptionsResponseSchema,
          context: "Не удалось загрузить валюты",
        }),
      ]);

    return {
      counterpartyOwners: toRelationOptions(counterparties.data),
      organizationOwners: toRelationOptions(organizations.data),
      providers: toRelationOptions(providers.data),
      currencies: toRelationOptions(currencies.data),
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
    schema: RequisiteDetailsApiSchema.transform(serializeDetails),
  });
};

export const getRequisiteById = cache(getRequisiteByIdUncached);
