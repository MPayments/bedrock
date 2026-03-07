import { cache } from "react";
import { z } from "zod";

import { CounterpartyOptionsResponseSchema } from "@bedrock/core/counterparties/contracts";
import { CurrencyOptionsResponseSchema } from "@bedrock/core/currencies/contracts";
import {
  ORGANIZATION_REQUISITES_LIST_CONTRACT,
} from "@bedrock/core/organization-requisites/contracts";

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
  OrganizationRequisiteDetails,
  OrganizationRequisiteFormOptions,
  OrganizationRequisitesListResult,
} from "./types";
import type { OrganizationRequisitesSearchParams } from "./validations";

const RequisiteApiSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
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
  OrganizationRequisiteDetails
>((row) => ({
  id: row.id,
  ownerId: row.organizationId,
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

function createListQuery(search: OrganizationRequisitesSearchParams) {
  return createResourceListQuery(ORGANIZATION_REQUISITES_LIST_CONTRACT, search);
}

async function getOrganizationLabelById() {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.counterparties["internal-ledger-entities"].$get(
        {},
        { init: { cache: "force-cache" } },
      ),
    schema: CounterpartyOptionsResponseSchema,
    context: "Не удалось загрузить внутренние организации",
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
    ownerId: row.organizationId,
    ownerDisplay: ownerLabelById.get(row.organizationId) ?? "—",
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

export async function getOrganizationRequisites(
  search: OrganizationRequisitesSearchParams,
): Promise<OrganizationRequisitesListResult> {
  const client = await getServerApiClient();
  const [{ data: payload }, ownerLabelById, currencyLabelById] = await Promise.all([
    readPaginatedList({
      request: () =>
        client.v1["organization-requisites"].$get({
          query: createListQuery(search),
        }),
      schema: RequisitesListResponseSchema,
      context: "Не удалось загрузить реквизиты организаций",
    }),
    getOrganizationLabelById(),
    getCurrencyLabelById(),
  ]);

  return {
    ...payload,
    data: payload.data.map((row) =>
      serializeRow(row, ownerLabelById, currencyLabelById),
    ),
  };
}

const getOrganizationRequisiteByIdUncached = async (
  id: string,
): Promise<OrganizationRequisiteDetails | null> => {
  return readEntityById({
    id,
    resourceName: "реквизит организации",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1["organization-requisites"][":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: RequisiteDetailsSchema,
  });
};

export const getOrganizationRequisiteById = cache(
  getOrganizationRequisiteByIdUncached,
);

export async function getOrganizationRequisiteFormOptions(): Promise<OrganizationRequisiteFormOptions> {
  const client = await getServerApiClient();
  const [owners, currencies] = await Promise.all([
    readOptionsList({
      request: () =>
        client.v1.counterparties["internal-ledger-entities"].$get(
          {},
          { init: { cache: "force-cache" } },
        ),
      schema: CounterpartyOptionsResponseSchema,
      context: "Не удалось загрузить организации",
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

export async function getOrganizationRequisiteCurrencyFilterOptions() {
  const labelById = await getCurrencyLabelById();

  return [...labelById.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
