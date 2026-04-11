import { cache } from "react";
import { z } from "zod";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import {
  CounterpartyOptionsResponseSchema,
  OrganizationOptionsResponseSchema,
  RequisiteProviderOptionsResponseSchema,
} from "@bedrock/parties/contracts";

import {
  getRequisiteKindLabel,
  type RelationOption,
  type RequisiteKind,
  type SerializedRequisite,
} from "@/features/entities/requisites-shared/lib/constants";
import {
  resolveLegacyRequisiteIdentity,
  toLegacyRequisiteValues,
} from "@/features/entities/requisites-shared/lib/master-data";
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
  organizationId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
});

const RequisiteDetailsApiSchema = z.object({
  id: z.uuid(),
  ownerType: z.enum(["organization", "counterparty"]),
  ownerId: z.uuid(),
  organizationId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
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
  identifiers: z.array(
    z.object({
      scheme: z.string(),
      value: z.string(),
      isPrimary: z.boolean(),
    }),
  ),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
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
    identity: resolveLegacyRequisiteIdentity({
      kind: row.kind,
      label: row.label,
      beneficiaryName: row.beneficiaryName,
    }),
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeDetails(
  row: z.infer<typeof RequisiteDetailsApiSchema>,
): RequisiteDetailsWithOwnerType {
  const legacyValues = toLegacyRequisiteValues({
    kind: row.kind,
    beneficiaryName: row.beneficiaryName,
    beneficiaryNameLocal: row.beneficiaryNameLocal,
    beneficiaryAddress: row.beneficiaryAddress,
    paymentPurposeTemplate: row.paymentPurposeTemplate,
    notes: row.notes,
    identifiers: row.identifiers,
  });

  return {
    id: row.id,
    ownerType: row.ownerType,
    ownerId: row.ownerId,
    providerId: row.providerId,
    providerBranchId: row.providerBranchId ?? "",
    currencyId: row.currencyId,
    kind: row.kind,
    label: row.label,
    description: legacyValues.description,
    beneficiaryName: legacyValues.beneficiaryName,
    beneficiaryNameLocal: legacyValues.beneficiaryNameLocal,
    beneficiaryAddress: legacyValues.beneficiaryAddress,
    accountNo: legacyValues.accountNo,
    corrAccount: legacyValues.corrAccount,
    iban: legacyValues.iban,
    network: legacyValues.network,
    assetCode: legacyValues.assetCode,
    address: legacyValues.address,
    memoTag: legacyValues.memoTag,
    accountRef: legacyValues.accountRef,
    subaccountRef: legacyValues.subaccountRef,
    contact: legacyValues.contact,
    notes: legacyValues.notes,
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

export async function getRequisiteFormOptions(): Promise<RequisiteFormOptions> {
  const client = await getServerApiClient();
  const [counterparties, organizations, providers, currencies] =
    await Promise.all([
      readOptionsList({
        request: () =>
          client.v1.counterparties.options.$get({}, { init: { cache: "no-store" } }),
        schema: CounterpartyOptionsResponseSchema,
        context: "Не удалось загрузить контрагентов",
      }),
      readOptionsList({
        request: () =>
          client.v1.organizations.options.$get({}, { init: { cache: "no-store" } }),
        schema: OrganizationOptionsResponseSchema,
        context: "Не удалось загрузить организации",
      }),
      readOptionsList({
        request: () =>
          client.v1.requisites.providers.options.$get(
            {},
            { init: { cache: "no-store" } },
          ),
        schema: RequisiteProviderOptionsResponseSchema,
        context: "Не удалось загрузить провайдеров реквизитов",
      }),
      readOptionsList({
        request: () =>
          client.v1.currencies.options.$get({}, { init: { cache: "no-store" } }),
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
}

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
