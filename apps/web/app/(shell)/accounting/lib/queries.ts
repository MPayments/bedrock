import { getServerApiClient } from "@/lib/api-client.server";

interface AccountingTemplateAccount {
  accountNo: string;
  name: string;
  kind: string;
  normalSide: string;
  postingAllowed: boolean;
  enabled: boolean;
  parentAccountNo: string | null;
  createdAt: string;
}

export interface AccountingCorrespondenceRule {
  id: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AccountingOrgOption {
  id: string;
  shortName: string;
}

interface CounterpartyGroupOption {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
}

export interface FinancialResultSummaryByCurrencyDto {
  currency: string;
  revenueMinor: string;
  expenseMinor: string;
  netMinor: string;
}

export interface FinancialResultsByCounterpartyRowDto {
  entityType: "counterparty" | "unattributed";
  counterpartyId: string | null;
  counterpartyName: string | null;
  currency: string;
  revenueMinor: string;
  expenseMinor: string;
  netMinor: string;
}

export interface FinancialResultsByGroupRowDto {
  groupId: string;
  groupCode: string | null;
  groupName: string | null;
  currency: string;
  revenueMinor: string;
  expenseMinor: string;
  netMinor: string;
}

export interface FinancialResultsByCounterpartyDto {
  data: FinancialResultsByCounterpartyRowDto[];
  total: number;
  limit: number;
  offset: number;
  summaryByCurrency: FinancialResultSummaryByCurrencyDto[];
}

export interface FinancialResultsByGroupDto {
  data: FinancialResultsByGroupRowDto[];
  total: number;
  limit: number;
  offset: number;
  summaryByCurrency: FinancialResultSummaryByCurrencyDto[];
  unattributedByCurrency: FinancialResultSummaryByCurrencyDto[];
}

export async function getAccountingOrgOptions(): Promise<AccountingOrgOption[]> {
  const client = await getServerApiClient();
  const res = await client.v1.counterparties.$get(
    {
      query: {
        limit: 100,
        offset: 0,
      } as Record<string, unknown>,
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch org options: ${res.status}`);
  }

  const payload = (await res.json()) as {
    data: {
      id: string;
      shortName: string;
    }[];
  };

  return payload.data;
}

export async function getCounterpartyGroupOptions(): Promise<
  CounterpartyGroupOption[]
> {
  const client = await getServerApiClient();
  const res = await client.v1["counterparty-groups"].$get(
    {
      query: {
        includeSystem: true,
      },
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch group options: ${res.status}`);
  }

  const payload = (await res.json()) as CounterpartyGroupOption[];
  return payload;
}

export async function getAccountingTemplateAccounts(): Promise<
  AccountingTemplateAccount[]
> {
  const client = await getServerApiClient();
  const res = await client.v1.accounting.template.accounts.$get(
    {},
    { init: { cache: "no-store" } },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch template accounts: ${res.status}`);
  }

  return (await res.json()) as AccountingTemplateAccount[];
}

export async function getAccountingCorrespondenceRules(
): Promise<AccountingCorrespondenceRule[]> {
  const client = await getServerApiClient();
  const res = await client.v1.accounting["correspondence-rules"].$get(
    {},
    { init: { cache: "no-store" } },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch correspondence rules: ${res.status}`);
  }

  return (await res.json()) as AccountingCorrespondenceRule[];
}

export async function getFinancialResultsByCounterparty(
  query: Record<string, string | string[]>,
): Promise<FinancialResultsByCounterpartyDto> {
  const client = await getServerApiClient();
  const res = await client.v1.accounting["financial-results"].counterparties.$get(
    {
      query,
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch financial results by counterparty: ${res.status}`,
    );
  }

  return (await res.json()) as FinancialResultsByCounterpartyDto;
}

export async function getFinancialResultsByGroup(
  query: Record<string, string | string[]>,
): Promise<FinancialResultsByGroupDto> {
  const client = await getServerApiClient();
  const res = await client.v1.accounting["financial-results"].groups.$get(
    {
      query,
    },
    {
      init: { cache: "no-store" },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch financial results by group: ${res.status}`);
  }

  return (await res.json()) as FinancialResultsByGroupDto;
}
