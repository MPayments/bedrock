import { cache } from "react";

import { COUNTERPARTIES_LIST_CONTRACT } from "@bedrock/counterparties/contracts";

import { getServerApiClient } from "@/lib/api-client.server";
import { readResourceById } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { CounterpartiesListResult } from "../components/counterparties-table";
import { type CounterpartiesSearchParams } from "./validations";

function createCounterpartiesListQuery(search: CounterpartiesSearchParams) {
  return createResourceListQuery(COUNTERPARTIES_LIST_CONTRACT, search);
}

export async function getCounterparties(
  search: CounterpartiesSearchParams,
): Promise<CounterpartiesListResult> {
  const client = await getServerApiClient();
  const res = await client.v1.counterparties.$get(
    {
      query: createCounterpartiesListQuery(search),
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch counterparties: ${res.status}`);
  }

  return res.json() as Promise<CounterpartiesListResult>;
}

export interface CounterpartyDetails {
  id: string;
  externalId: string | null;
  customerId: string | null;
  shortName: string;
  fullName: string;
  description: string | null;
  country: string | null;
  kind: "legal_entity" | "individual";
  groupIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CounterpartyGroupOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  customerId: string | null;
  isSystem: boolean;
}

const getCounterpartyByIdUncached = async (
  id: string,
): Promise<CounterpartyDetails | null> => {
  return readResourceById<CounterpartyDetails>({
    id,
    resourceName: "counterparty",
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
  });
};

export const getCounterpartyById = cache(getCounterpartyByIdUncached);

export async function getCounterpartyGroups(): Promise<CounterpartyGroupOption[]> {
  const client = await getServerApiClient();
  const res = await client.v1["counterparty-groups"].$get(
    {
      query: {},
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch counterparty groups: ${res.status}`);
  }

  return (await res.json()) as CounterpartyGroupOption[];
}

type CounterpartyAccountPayload = {
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
};

type AccountProviderPayload = {
  id: string;
  name: string;
  type: string;
};

type CurrencyPayload = {
  id: string;
  code: string;
  name: string;
};

type PaginatedPayload<T> = {
  data: T[];
  total?: number;
  limit?: number;
};

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

async function listAllCounterpartyAccounts(
  client: Awaited<ReturnType<typeof getServerApiClient>>,
  counterpartyId: string,
): Promise<CounterpartyAccountPayload[]> {
  const ACCOUNTS_PAGE_SIZE = 100;
  const accounts: CounterpartyAccountPayload[] = [];
  let offset = 0;

  while (true) {
    const res = await client.v1.accounts.$get(
      {
        query: {
          limit: ACCOUNTS_PAGE_SIZE,
          offset,
          counterpartyId,
          sortBy: "createdAt",
          sortOrder: "desc",
        } as Record<string, unknown>,
      },
      {
        init: { cache: "no-store" },
      },
    );

    if (!res.ok) {
      throw new Error(`Failed to fetch accounts: ${res.status}`);
    }

    const payload = (await res.json()) as PaginatedPayload<CounterpartyAccountPayload>;
    accounts.push(...payload.data);

    if (payload.data.length === 0) {
      break;
    }

    const limit =
      typeof payload.limit === "number" && payload.limit > 0
        ? payload.limit
        : ACCOUNTS_PAGE_SIZE;
    offset += limit;

    if (typeof payload.total === "number" && offset >= payload.total) {
      break;
    }
  }

  return accounts;
}

async function listAllAccountProviders(
  client: Awaited<ReturnType<typeof getServerApiClient>>,
): Promise<AccountProviderPayload[]> {
  const PROVIDERS_PAGE_SIZE = 100;
  const providers: AccountProviderPayload[] = [];
  let offset = 0;

  while (true) {
    const res = await client.v1["account-providers"].$get(
      {
        query: {
          limit: PROVIDERS_PAGE_SIZE,
          offset,
        } as Record<string, unknown>,
      },
      {
        init: { cache: "no-store" },
      },
    );

    if (!res.ok) {
      break;
    }

    const payload = (await res.json()) as PaginatedPayload<AccountProviderPayload>;
    providers.push(...payload.data);

    if (payload.data.length === 0) {
      break;
    }

    const limit =
      typeof payload.limit === "number" && payload.limit > 0
        ? payload.limit
        : PROVIDERS_PAGE_SIZE;
    offset += limit;

    if (typeof payload.total === "number" && offset >= payload.total) {
      break;
    }
  }

  return providers;
}

async function listAllCurrencies(
  client: Awaited<ReturnType<typeof getServerApiClient>>,
): Promise<CurrencyPayload[]> {
  const CURRENCIES_PAGE_SIZE = 100;
  const currencies: CurrencyPayload[] = [];
  let offset = 0;

  while (true) {
    const res = await client.v1.currencies.$get({
      query: {
        limit: CURRENCIES_PAGE_SIZE,
        offset,
      } as Record<string, unknown>,
    });

    if (!res.ok) {
      break;
    }

    const payload = (await res.json()) as PaginatedPayload<CurrencyPayload>;
    currencies.push(...payload.data);

    if (payload.data.length === 0) {
      break;
    }

    const limit =
      typeof payload.limit === "number" && payload.limit > 0
        ? payload.limit
        : CURRENCIES_PAGE_SIZE;
    offset += limit;

    if (typeof payload.total === "number" && offset >= payload.total) {
      break;
    }
  }

  return currencies;
}

export interface AccountBalance {
  operationalAccountId: string;
  currency: string;
  balanceMinor: string;
  precision: number;
}

export async function getAccountBalances(
  accountIds: string[],
): Promise<AccountBalance[]> {
  if (accountIds.length === 0) return [];

  const client = await getServerApiClient();
  const res = await client.v1.accounting["operational-account-balances"].$get(
    {
      query: { accountIds: accountIds.join(",") },
    },
    { init: { cache: "no-store" } },
  );

  if (!res.ok) return [];

  return (await res.json()) as AccountBalance[];
}

export async function getCounterpartyAccounts(
  counterpartyId: string,
): Promise<CounterpartyAccount[]> {
  const client = await getServerApiClient();
  const accounts = await listAllCounterpartyAccounts(client, counterpartyId);

  if (accounts.length === 0) {
    return [];
  }

  const [providers, currencies] = await Promise.all([
    listAllAccountProviders(client),
    listAllCurrencies(client),
  ]);

  const providerById = new Map(
    providers.map((provider) => [provider.id, provider] as const),
  );
  const currencyById = new Map(
    currencies.map((currency) => [currency.id, currency] as const),
  );

  return accounts.map((account) => {
    const provider = providerById.get(account.accountProviderId);
    const currency = currencyById.get(account.currencyId);

    return {
      ...account,
      providerName: provider?.name ?? account.accountProviderId,
      providerType: provider?.type ?? null,
      currencyCode: currency?.code ?? account.currencyId,
      currencyName: currency?.name ?? account.currencyId,
    };
  });
}
