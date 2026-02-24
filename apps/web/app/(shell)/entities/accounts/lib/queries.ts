import { cache } from "react";

import { ACCOUNTS_LIST_CONTRACT } from "@bedrock/accounts";

import { getServerApiClient } from "@/lib/api-client.server";
import { readResourceById } from "@/lib/resources/http";
import { createResourceListQuery } from "@/lib/resources/search-params";

import type { AccountsListResult } from "../(table)";
import type { AccountsSearchParams } from "./validations";

function createAccountsListQuery(search: AccountsSearchParams) {
  return createResourceListQuery(ACCOUNTS_LIST_CONTRACT, search);
}

export async function getAccounts(
  search: AccountsSearchParams,
): Promise<AccountsListResult> {
  const client = await getServerApiClient();
  const res = await client.v1.accounts.$get({
    query: createAccountsListQuery(search),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch accounts: ${res.status}`);
  }

  return res.json() as Promise<AccountsListResult>;
}

export interface AccountDetails {
  id: string;
  counterpartyId: string;
  currencyId: string;
  accountProviderId: string;
  label: string;
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
    client.v1.currencies.$get(
      { query: { limit: 100, offset: 0 } as Record<string, unknown> },
    ),
    client.v1["account-providers"].$get(
      { query: { limit: 100, offset: 0 } as Record<string, unknown> },
      { init: { cache: "no-store" } },
    ),
  ]);

  if (!counterpartiesRes.ok) {
    throw new Error(`Failed to fetch counterparties: ${counterpartiesRes.status}`);
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
