import { cache } from "react";
import { z } from "zod";

import {
  CounterpartyOptionsResponseSchema,
} from "@bedrock/platform/counterparties/contracts";
import {
  ACCOUNTS_LIST_CONTRACT,
} from "@bedrock/platform/operational-accounts/contracts";
import {
  CurrencyOptionsResponseSchema,
} from "@bedrock/platform/currencies/contracts";
import {
  AccountProviderOptionsResponseSchema,
} from "@bedrock/platform/operational-accounts/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readEntityById, readOptionsList, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { AccountsListResult } from "../(table)";
import type { AccountsSearchParams } from "./validations";

const AccountResponseSchema = z.object({
  id: z.uuid(),
  counterpartyId: z.uuid(),
  bookId: z.uuid(),
  currencyId: z.uuid(),
  accountProviderId: z.uuid(),
  label: z.string(),
  description: z.string().nullable(),
  accountNo: z.string().nullable(),
  corrAccount: z.string().nullable(),
  address: z.string().nullable(),
  iban: z.string().nullable(),
  stableKey: z.string(),
  postingAccountNo: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const AccountsListResponseSchema = createPaginatedResponseSchema(
  AccountResponseSchema,
);
const AccountDetailsSchema = AccountResponseSchema.omit({ bookId: true, postingAccountNo: true });

function createAccountsListQuery(search: AccountsSearchParams) {
  return createResourceListQuery(ACCOUNTS_LIST_CONTRACT, search);
}

async function getCurrencyOptionsById() {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1.currencies.options.$get({}, { init: { cache: "force-cache" } }),
    schema: CurrencyOptionsResponseSchema,
    context: "Не удалось загрузить валюты",
  });

  return new Map(payload.data.map((currency) => [currency.id, currency.label]));
}

export async function getAccountCurrencyFilterOptions(): Promise<
  { value: string; label: string }[]
> {
  const payload = await getCurrencyOptionsById();

  return [...payload.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getAccounts(
  search: AccountsSearchParams,
): Promise<AccountsListResult> {
  const client = await getServerApiClient();
  const [{ data: accountsPayload }, currencyNameById] = await Promise.all([
    readPaginatedList({
      request: () =>
        client.v1.accounts.$get({
          query: createAccountsListQuery(search),
        }),
      schema: AccountsListResponseSchema,
      context: "Не удалось загрузить счета",
    }),
    getCurrencyOptionsById(),
  ]);

  return {
    ...accountsPayload,
    data: accountsPayload.data.map((account) => ({
      ...account,
      currencyDisplay: currencyNameById.get(account.currencyId) ?? "—",
    })),
  };
}

export type AccountDetails = z.infer<typeof AccountDetailsSchema>;

const getAccountByIdUncached = async (
  id: string,
): Promise<AccountDetails | null> => {
  return readEntityById({
    id,
    resourceName: "счет",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.accounts[":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
    schema: AccountDetailsSchema,
  });
};

export const getAccountById = cache(getAccountByIdUncached);

export type RelationOption = { id: string; label: string };

export type AccountFormOptions = {
  counterparties: RelationOption[];
  currencies: RelationOption[];
  providers: (RelationOption & { type: string; country: string })[];
};

export async function getAccountFormOptions(): Promise<AccountFormOptions> {
  const client = await getServerApiClient();
  const [counterparties, currencies, providers] = await Promise.all([
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
        client.v1.currencies.options.$get(
          {},
          { init: { cache: "force-cache" } },
        ),
      schema: CurrencyOptionsResponseSchema,
      context: "Не удалось загрузить валюты",
    }),
    readOptionsList({
      request: () =>
        client.v1["account-providers"].options.$get(
          {},
          { init: { cache: "force-cache" } },
        ),
      schema: AccountProviderOptionsResponseSchema,
      context: "Не удалось загрузить провайдеров",
    }),
  ]);

  return {
    counterparties: counterparties.data.map((item) => ({
      id: item.id,
      label: item.label,
    })),
    currencies: currencies.data.map((item) => ({
      id: item.id,
      label: item.label,
    })),
    providers: providers.data.map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type,
      country: item.country,
    })),
  };
}
