import { cache } from "react";

import { ACCOUNTS_LIST_CONTRACT } from "@bedrock/operational-accounts/contracts";

import { getServerApiClient } from "@/lib/api-client.server";
import { readResourceById } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { AccountsListResult } from "../(table)";
import type { AccountsSearchParams } from "./validations";

function createAccountsListQuery(search: AccountsSearchParams) {
  return createResourceListQuery(ACCOUNTS_LIST_CONTRACT, search);
}

type AccountCurrency = {
  id: string;
  code: string;
  name: string;
};

async function listAllCurrencies(
  client: Awaited<ReturnType<typeof getServerApiClient>>,
): Promise<AccountCurrency[]> {
  const CURRENCIES_PAGE_SIZE = 100;
  const currencies: AccountCurrency[] = [];
  let offset = 0;

  while (true) {
    const currenciesRes = await client.v1.currencies.$get({
      query: { limit: CURRENCIES_PAGE_SIZE, offset } as Record<string, unknown>,
    });

    if (!currenciesRes.ok) {
      break;
    }

    const payload = (await currenciesRes.json()) as {
      data: AccountCurrency[];
      total?: number;
      limit?: number;
    };

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

const getAllCurrencies = cache(async (): Promise<AccountCurrency[]> => {
  const client = await getServerApiClient();
  return listAllCurrencies(client);
});

export async function getAccountCurrencyFilterOptions(): Promise<
  { value: string; label: string }[]
> {
  const currencies = await getAllCurrencies();

  return currencies
    .map((currency) => ({
      value: currency.id,
      label: currency.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getAccounts(
  search: AccountsSearchParams,
): Promise<AccountsListResult> {
  const client = await getServerApiClient();
  const accountsRes = await client.v1.accounts.$get({
    query: createAccountsListQuery(search),
  });

  if (!accountsRes.ok) {
    throw new Error(`Failed to fetch accounts: ${accountsRes.status}`);
  }

  const accountsPayload = (await accountsRes.json()) as AccountsListResult;
  const accountCurrencyIds = new Set(
    accountsPayload.data.map((account) => account.currencyId),
  );
  const currencyNameById = new Map<string, string>();

  if (accountCurrencyIds.size > 0) {
    const currencies = await getAllCurrencies();
    for (const currency of currencies) {
      if (accountCurrencyIds.has(currency.id)) {
        currencyNameById.set(currency.id, currency.name);
      }
      if (currencyNameById.size === accountCurrencyIds.size) {
        break;
      }
    }
  }

  return {
    ...accountsPayload,
    data: accountsPayload.data.map((account) => ({
      ...account,
      currencyDisplay: currencyNameById.get(account.currencyId) ?? "—",
    })),
  };
}

export interface AccountDetails {
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
  createdAt: string;
  updatedAt: string;
}

const getAccountByIdUncached = async (
  id: string,
): Promise<AccountDetails | null> => {
  return readResourceById<AccountDetails>({
    id,
    resourceName: "account",
    request: async (validId) => {
      const client = await getServerApiClient();
      return client.v1.accounts[":id"].$get(
        { param: { id: validId } },
        { init: { cache: "no-store" } },
      );
    },
  });
};

export const getAccountById = cache(getAccountByIdUncached);

// ---------------------------------------------------------------------------
// Options for relation comboboxes
// ---------------------------------------------------------------------------

export type RelationOption = { id: string; label: string };

export type AccountFormOptions = {
  counterparties: RelationOption[];
  currencies: RelationOption[];
  providers: (RelationOption & { type: string; country: string })[];
};

export async function getAccountFormOptions(): Promise<AccountFormOptions> {
  const client = await getServerApiClient();

  const [counterpartiesRes, currenciesRes, providersRes] = await Promise.all([
    client.v1.counterparties.$get(
      { query: { limit: 100, offset: 0 } as Record<string, unknown> },
      { init: { cache: "no-store" } },
    ),
    client.v1.currencies.$get({
      query: { limit: 100, offset: 0 } as Record<string, unknown>,
    }),
    client.v1["account-providers"].$get(
      { query: { limit: 100, offset: 0 } as Record<string, unknown> },
      { init: { cache: "no-store" } },
    ),
  ]);

  if (!counterpartiesRes.ok) {
    throw new Error(
      `Failed to fetch counterparties: ${counterpartiesRes.status}`,
    );
  }
  if (!currenciesRes.ok) {
    throw new Error(`Failed to fetch currencies: ${currenciesRes.status}`);
  }
  if (!providersRes.ok) {
    throw new Error(`Failed to fetch providers: ${providersRes.status}`);
  }

  const counterpartiesData = (await counterpartiesRes.json()) as {
    data: { id: string; shortName: string }[];
  };
  const currenciesData = (await currenciesRes.json()) as {
    data: { id: string; code: string; name: string }[];
  };
  const providersData = (await providersRes.json()) as {
    data: { id: string; name: string; type: string; country: string }[];
  };

  return {
    counterparties: counterpartiesData.data.map((c) => ({
      id: c.id,
      label: c.shortName,
    })),
    currencies: currenciesData.data.map((c) => ({
      id: c.id,
      label: `${c.code} — ${c.name}`,
    })),
    providers: providersData.data.map((p) => ({
      id: p.id,
      label: p.name,
      type: p.type,
      country: p.country,
    })),
  };
}
