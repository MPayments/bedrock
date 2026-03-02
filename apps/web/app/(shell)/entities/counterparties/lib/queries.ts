import { cache } from "react";
import { z } from "zod";

import {
  CounterpartyGroupOptionsResponseSchema,
  type CounterpartyGroupOption,
} from "@bedrock/platform/counterparties/contracts";
import {
  CurrencyOptionsResponseSchema,
} from "@bedrock/platform/currencies/contracts";
import {
  AccountProviderOptionsResponseSchema,
} from "@bedrock/platform/operational-accounts/contracts";
import { COUNTERPARTIES_LIST_CONTRACT } from "@bedrock/platform/counterparties/contracts";

import { getServerApiClient } from "@/lib/api/server-client";
import { createPaginatedResponseSchema } from "@/lib/api/schemas";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";
import { readEntityById, readOptionsList, readPaginatedList } from "@/lib/api/query";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { CounterpartiesListResult } from "../components/counterparties-table";
import { type CounterpartiesSearchParams } from "./validations";

const CounterpartyResponseSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  customerId: z.uuid().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  kind: z.enum(["legal_entity", "individual"]),
  groupIds: z.array(z.uuid()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const CounterpartiesListResponseSchema = createPaginatedResponseSchema(
  CounterpartyResponseSchema,
);

const CounterpartyAccountSchema = z.object({
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

const CounterpartyAccountsListResponseSchema = createPaginatedResponseSchema(
  CounterpartyAccountSchema,
);

function createCounterpartiesListQuery(search: CounterpartiesSearchParams) {
  return createResourceListQuery(COUNTERPARTIES_LIST_CONTRACT, search);
}

export async function getCounterparties(
  search: CounterpartiesSearchParams,
): Promise<CounterpartiesListResult> {
  const client = await getServerApiClient();
  const { data } = await readPaginatedList({
    request: () =>
      client.v1.counterparties.$get(
        {
          query: createCounterpartiesListQuery(search),
        },
        {
          init: { cache: "no-store" },
        },
      ),
    schema: CounterpartiesListResponseSchema,
    context: "Не удалось загрузить контрагентов",
  });

  return data;
}

export type CounterpartyDetails = z.infer<typeof CounterpartyResponseSchema>;
export type { CounterpartyGroupOption };
const getCounterpartyByIdUncached = async (
  id: string,
): Promise<CounterpartyDetails | null> => {
  return readEntityById({
    id,
    resourceName: "контрагента",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.counterparties[":id"].$get(
        {
          param: { id: validId },
        },
        {
          init: { cache: "no-store" },
        },
      );
    },
    schema: CounterpartyResponseSchema,
  });
};

export const getCounterpartyById = cache(getCounterpartyByIdUncached);

export async function getCounterpartyGroups(): Promise<CounterpartyGroupOption[]> {
  const client = await getServerApiClient();
  const payload = await readOptionsList({
    request: () =>
      client.v1["counterparty-groups"].$get(
        { query: { includeSystem: true } },
        {
          init: { cache: "force-cache" },
        },
      ),
    schema: CounterpartyGroupOptionsResponseSchema,
    context: "Не удалось загрузить группы контрагентов",
  });

  return payload.data;
}

export interface AccountBalance {
  operationalAccountId: string;
  currency: string;
  balanceMinor: string;
  precision: number;
}

const AccountBalancesResponseSchema = z.array(
  z.object({
    operationalAccountId: z.uuid(),
    currency: z.string(),
    balanceMinor: z.string(),
    precision: z.number().int(),
  }),
);

export async function getAccountBalances(
  accountIds: string[],
): Promise<AccountBalance[]> {
  if (accountIds.length === 0) {
    return [];
  }

  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.accounting["operational-account-balances"].$get(
      {
        query: {
          accountIds: accountIds.join(","),
        },
      },
      {
        init: { cache: "no-store" },
      },
    ),
    "Не удалось загрузить балансы счетов",
  );

  return readJsonWithSchema(response, AccountBalancesResponseSchema);
}

export interface CounterpartyAccount {
  id: string;
  counterpartyId: string;
  currencyId: string;
  accountProviderId: string;
  label: string;
  description: string | null;
  accountNo: string | null;
  corrAccount: string | null;
  address: string | null;
  iban: string | null;
  stableKey: string;
  postingAccountNo: string;
  createdAt: string;
  updatedAt: string;
  providerName: string;
  providerType: string | null;
  currencyCode: string;
  currencyName: string;
}

export async function getCounterpartyAccounts(
  counterpartyId: string,
): Promise<CounterpartyAccount[]> {
  const client = await getServerApiClient();
  const [{ data: accounts }, providers, currencies] = await Promise.all([
    readPaginatedList({
      request: () =>
        client.v1.accounts.$get(
          {
            query: {
              limit: 500,
              offset: 0,
              counterpartyId,
              sortBy: "createdAt",
              sortOrder: "desc",
            },
          },
          {
            init: { cache: "no-store" },
          },
        ),
      schema: CounterpartyAccountsListResponseSchema,
      context: "Не удалось загрузить счета контрагента",
    }),
    readOptionsList({
      request: () =>
        client.v1["account-providers"].options.$get(
          {},
          {
            init: { cache: "force-cache" },
          },
        ),
      schema: AccountProviderOptionsResponseSchema,
      context: "Не удалось загрузить провайдеров",
    }),
    readOptionsList({
      request: () =>
        client.v1.currencies.options.$get(
          {},
          {
            init: { cache: "force-cache" },
          },
        ),
      schema: CurrencyOptionsResponseSchema,
      context: "Не удалось загрузить валюты",
    }),
  ]);

  const providerById = new Map(
    providers.data.map((provider) => [provider.id, provider]),
  );
  const currencyById = new Map(
    currencies.data.map((currency) => [currency.id, currency]),
  );

  return accounts.data.map((account) => {
    const provider = providerById.get(account.accountProviderId);
    const currency = currencyById.get(account.currencyId);

    return {
      ...account,
      providerName: provider?.name ?? "—",
      providerType: provider?.type ?? null,
      currencyCode: currency?.code ?? "—",
      currencyName: currency?.name ?? "—",
    };
  });
}
