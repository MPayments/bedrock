import { cache } from "react";
import { z } from "zod";

import { CounterpartyOptionsResponseSchema } from "@bedrock/core/counterparties/contracts";
import {
  COUNTERPARTY_REQUISITES_LIST_CONTRACT,
} from "@bedrock/core/counterparty-requisites/contracts";
import { CurrencyOptionsResponseSchema } from "@bedrock/core/currencies/contracts";

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
  CounterpartyRequisiteDetails,
  CounterpartyRequisiteFormOptions,
  CounterpartyRequisitesListResult,
} from "./types";
import type { CounterpartyRequisitesSearchParams } from "./validations";

const RequisiteApiSchema = z.object({
  id: z.uuid(),
  counterpartyId: z.uuid(),
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

const RequisitesListResponseSchema = createPaginatedResponseSchema(
  RequisiteApiSchema,
);

const RequisiteDetailsSchema = RequisiteApiSchema.transform<
  CounterpartyRequisiteDetails
>((row) => ({
  id: row.id,
  ownerId: row.counterpartyId,
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
}));

function createListQuery(search: CounterpartyRequisitesSearchParams) {
  return createResourceListQuery(COUNTERPARTY_REQUISITES_LIST_CONTRACT, search);
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
  currencyLabelById: ReadonlyMap<string, string>,
): SerializedRequisite {
  return {
    id: row.id,
    ownerId: row.counterpartyId,
    ownerDisplay: ownerLabelById.get(row.counterpartyId) ?? "—",
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

export async function getCounterpartyRequisites(
  search: CounterpartyRequisitesSearchParams,
): Promise<CounterpartyRequisitesListResult> {
  const client = await getServerApiClient();
  const [{ data: payload }, ownerLabelById, currencyLabelById] = await Promise.all([
    readPaginatedList({
      request: () =>
        client.v1["counterparty-requisites"].$get({
          query: createListQuery(search),
        }),
      schema: RequisitesListResponseSchema,
      context: "Не удалось загрузить реквизиты контрагентов",
    }),
    getCounterpartyLabelById(),
    getCurrencyLabelById(),
  ]);

  return {
    ...payload,
    data: payload.data.map((row) =>
      serializeRow(row, ownerLabelById, currencyLabelById),
    ),
  };
}

export async function getCounterpartyRequisitesForCounterparty(
  counterpartyId: string,
): Promise<SerializedRequisite[]> {
  const client = await getServerApiClient();
  const [{ data: payload }, ownerLabelById, currencyLabelById] = await Promise.all([
    readPaginatedList({
      request: () =>
        client.v1["counterparty-requisites"].$get({
          query: {
            counterpartyId,
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
    getCurrencyLabelById(),
  ]);

  return payload.data.map((row) =>
    serializeRow(row, ownerLabelById, currencyLabelById),
  );
}

const getCounterpartyRequisiteByIdUncached = async (
  id: string,
): Promise<CounterpartyRequisiteDetails | null> => {
  return readEntityById({
    id,
    resourceName: "реквизит контрагента",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1["counterparty-requisites"][":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: RequisiteDetailsSchema,
  });
};

export const getCounterpartyRequisiteById = cache(
  getCounterpartyRequisiteByIdUncached,
);

export async function getCounterpartyRequisiteFormOptions(): Promise<CounterpartyRequisiteFormOptions> {
  const client = await getServerApiClient();
  const [owners, currencies] = await Promise.all([
    readOptionsList({
      request: () =>
        client.v1.counterparties.options.$get({}, { init: { cache: "force-cache" } }),
      schema: CounterpartyOptionsResponseSchema,
      context: "Не удалось загрузить контрагентов",
    }),
    readOptionsList({
      request: () =>
        client.v1.currencies.options.$get({}, { init: { cache: "force-cache" } }),
      schema: CurrencyOptionsResponseSchema,
      context: "Не удалось загрузить валюты",
    }),
  ]);

  return {
    owners: owners.data.map((item) => ({ id: item.id, label: item.label })),
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
