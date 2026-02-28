import { getServerApiClient } from "@/lib/api-client.server";

export interface FundingFormAccount {
  id: string;
  label: string;
  counterpartyId: string;
  counterpartyName: string | null;
  currencyId: string;
  currencyCode: string;
  precision: number;
  postedBalanceMinor: string;
}

export interface FundingFormCounterparty {
  id: string;
  shortName: string;
  displayName: string;
}

export interface FundingFormCustomer {
  id: string;
  displayName: string;
}

export interface FundingFormOptions {
  accounts: FundingFormAccount[];
  counterparties: FundingFormCounterparty[];
  customers: FundingFormCustomer[];
}

export async function getExternalFundingFormOptions(): Promise<FundingFormOptions> {
  const client = await getServerApiClient();

  const [accountsRes, counterpartiesRes, customersRes, currenciesRes] =
    await Promise.all([
      client.v1.accounts.$get(
        { query: { limit: 100, offset: 0 } as Record<string, unknown> },
        { init: { cache: "no-store" } },
      ),
      client.v1.counterparties.$get(
        { query: { limit: 100, offset: 0 } as Record<string, unknown> },
        { init: { cache: "no-store" } },
      ),
      client.v1.customers.$get(
        { query: { limit: 100, offset: 0 } as Record<string, unknown> },
        { init: { cache: "no-store" } },
      ),
      client.v1.currencies.$get(
        { query: { limit: 100, offset: 0 } as Record<string, unknown> },
        { init: { cache: "no-store" } },
      ),
    ]);

  if (!accountsRes.ok) {
    throw new Error(`Failed to fetch accounts: ${accountsRes.status}`);
  }
  if (!counterpartiesRes.ok) {
    throw new Error(
      `Failed to fetch counterparties: ${counterpartiesRes.status}`,
    );
  }
  if (!customersRes.ok) {
    throw new Error(`Failed to fetch customers: ${customersRes.status}`);
  }
  if (!currenciesRes.ok) {
    throw new Error(`Failed to fetch currencies: ${currenciesRes.status}`);
  }

  const accountsPayload = (await accountsRes.json()) as {
    data: {
      id: string;
      label: string;
      counterpartyId: string;
      currencyId: string;
    }[];
  };
  const counterpartiesPayload = (await counterpartiesRes.json()) as {
    data: {
      id: string;
      shortName: string;
      fullName?: string | null;
    }[];
  };
  const customersPayload = (await customersRes.json()) as {
    data: {
      id: string;
      displayName: string;
    }[];
  };
  const currenciesPayload = (await currenciesRes.json()) as {
    data: {
      id: string;
      code: string;
      precision: number;
    }[];
  };

  const accountIds = accountsPayload.data.map((account) => account.id);
  const balancesRes =
    accountIds.length === 0
      ? null
      : await client.v1.accounting["operational-account-balances"].$get(
          {
            query: { accountIds: accountIds.join(",") },
          },
          { init: { cache: "no-store" } },
        );

  if (balancesRes && !balancesRes.ok) {
    throw new Error(
      `Failed to fetch account balances: ${balancesRes.status}`,
    );
  }

  const balancesPayload = balancesRes
    ? ((await balancesRes.json()) as {
        operationalAccountId: string;
        currency: string;
        balanceMinor: string;
        precision: number;
      }[])
    : [];

  const balanceByAccountId = new Map(
    balancesPayload.map((row) => [row.operationalAccountId, row.balanceMinor]),
  );
  const counterpartyById = new Map(
    counterpartiesPayload.data.map((counterparty) => [
      counterparty.id,
      counterparty,
    ]),
  );
  const currencyById = new Map(
    currenciesPayload.data.map((currency) => [currency.id, currency]),
  );

  return {
    accounts: accountsPayload.data
      .map((account) => {
        const currency = currencyById.get(account.currencyId);
        const counterparty = counterpartyById.get(account.counterpartyId);
        const counterpartyName = counterparty?.shortName?.trim()
          ? counterparty.shortName
          : (counterparty?.fullName ?? null);

        return {
          id: account.id,
          label: account.label,
          counterpartyId: account.counterpartyId,
          counterpartyName,
          currencyId: account.currencyId,
          currencyCode: currency?.code ?? "N/A",
          precision: currency?.precision ?? 2,
          postedBalanceMinor: balanceByAccountId.get(account.id) ?? "0",
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label)),
    counterparties: counterpartiesPayload.data
      .map((counterparty) => {
        const shortName = counterparty.shortName?.trim() ?? "";
        const fullName = counterparty.fullName?.trim() ?? "";
        return {
          id: counterparty.id,
          shortName: counterparty.shortName,
          displayName: shortName || fullName || counterparty.id,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    customers: customersPayload.data
      .map((customer) => ({
        id: customer.id,
        displayName: customer.displayName,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}
