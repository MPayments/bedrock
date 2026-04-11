import { cache } from "react";
import { z } from "zod";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import {
  CounterpartyOptionsResponseSchema,
  RequisiteProviderOptionsResponseSchema,
} from "@bedrock/parties/contracts";

import {
  getRequisiteKindLabel,
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
  CounterpartyRequisiteDetails,
  CounterpartyRequisiteFormOptions,
  CounterpartyRequisitesListResult,
} from "./types";
import type { CounterpartyRequisitesSearchParams } from "./validations";

const RequisiteApiSchema = z.object({
  id: z.uuid(),
  ownerType: z.literal("counterparty"),
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

const RequisiteDetailsSchema = RequisiteApiSchema.transform<
  CounterpartyRequisiteDetails
>((row) => ({
  ...toLegacyRequisiteValues({
    kind: row.kind,
    beneficiaryName: row.beneficiaryName,
    beneficiaryNameLocal: row.beneficiaryNameLocal,
    beneficiaryAddress: row.beneficiaryAddress,
    paymentPurposeTemplate: row.paymentPurposeTemplate,
    notes: row.notes,
    identifiers: row.identifiers,
  }),
  id: row.id,
  ownerId: row.ownerId,
  providerId: row.providerId,
  providerBranchId: row.providerBranchId ?? "",
  currencyId: row.currencyId,
  kind: row.kind,
  label: row.label,
  isDefault: row.isDefault,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
}));

const RawRequisiteDetailsSchema = RequisiteApiSchema.or(
  z.object({
    id: z.uuid(),
    ownerType: z.enum(["organization", "counterparty"]),
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
    identifiers: z.array(
      z.object({
        scheme: z.string(),
        value: z.string(),
        isPrimary: z.boolean(),
      }),
    ),
    isDefault: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
);

function createListQuery(search: CounterpartyRequisitesSearchParams) {
  return createResourceListQuery(REQUISITES_LIST_CONTRACT, search);
}

async function getCounterpartyLabelById() {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.counterparties.options.$get({}, { init: { cache: "force-cache" } }),
    schema: CounterpartyOptionsResponseSchema,
    context: "Не удалось загрузить контрагентов",
  });

  return new Map(payload.data.map((item) => [item.id, item.label]));
}

async function getProviderLabelById() {
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

export async function getCounterpartyRequisites(
  search: CounterpartyRequisitesSearchParams & { counterpartyId: string },
): Promise<CounterpartyRequisitesListResult> {
  const client = await getServerApiClient();
  const [{ data: payload }, ownerLabelById, providerLabelById, currencyLabelById] =
    await Promise.all([
      readPaginatedList({
        request: () =>
          client.v1.counterparties[":id"].requisites.$get({
            param: { id: search.counterpartyId },
            query: createListQuery(search),
          }),
        schema: RequisitesListResponseSchema,
        context: "Не удалось загрузить реквизиты контрагентов",
      }),
      getCounterpartyLabelById(),
      getProviderLabelById(),
      getCurrencyLabelById(),
    ]);

  return {
    ...payload,
    data: payload.data.map((row) =>
      serializeRow(row, ownerLabelById, providerLabelById, currencyLabelById),
    ),
  };
}

export async function getCounterpartyRequisitesForCounterparty(
  counterpartyId: string,
): Promise<SerializedRequisite[]> {
  const client = await getServerApiClient();
  const [{ data: payload }, ownerLabelById, providerLabelById, currencyLabelById] =
    await Promise.all([
      readPaginatedList({
        request: () =>
          client.v1.counterparties[":id"].requisites.$get({
            param: { id: counterpartyId },
            query: {
              limit: 100,
              offset: 0,
              sortBy: "createdAt",
              sortOrder: "desc",
            },
          }),
        schema: RequisitesListResponseSchema,
        context: "Не удалось загрузить реквизиты контрагента",
      }),
      getCounterpartyLabelById(),
      getProviderLabelById(),
      getCurrencyLabelById(),
    ]);

  return payload.data.map((row) =>
    serializeRow(row, ownerLabelById, providerLabelById, currencyLabelById),
  );
}

const getCounterpartyRequisiteByIdUncached = async (
  id: string,
): Promise<CounterpartyRequisiteDetails | null> => {
  const row = await readEntityById({
    id,
    resourceName: "реквизит контрагента",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.requisites[":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: RawRequisiteDetailsSchema,
  });

  if (!row || row.ownerType !== "counterparty") {
    return null;
  }

  return RequisiteDetailsSchema.parse(row);
};

export const getCounterpartyRequisiteById = cache(
  getCounterpartyRequisiteByIdUncached,
);

export async function getCounterpartyRequisiteFormOptions(): Promise<CounterpartyRequisiteFormOptions> {
  const client = await getServerApiClient();
  const [owners, providers, currencies] = await Promise.all([
    readOptionsList({
      request: () =>
        client.v1.counterparties.options.$get({}, { init: { cache: "no-store" } }),
      schema: CounterpartyOptionsResponseSchema,
      context: "Не удалось загрузить контрагентов",
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
    owners: owners.data.map((item) => ({ id: item.id, label: item.label })),
    providers: providers.data.map((item) => ({ id: item.id, label: item.label })),
    currencies: currencies.data.map((item) => ({
      id: item.id,
      label: item.label,
    })),
  };
}

export async function getCounterpartyRequisiteCurrencyFilterOptions() {
  const labelById = await getCurrencyLabelById();

  return [...labelById.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
