import { getServerApiClient } from "@/lib/api-client.server";

export interface AccountingTemplateAccount {
  accountNo: string;
  name: string;
  kind: string;
  normalSide: string;
  postingAllowed: boolean;
  parentAccountNo: string | null;
  createdAt: string;
}

export interface AccountingOrgAccount {
  orgId: string;
  accountNo: string;
  name: string;
  kind: string;
  normalSide: string;
  postingAllowed: boolean;
  enabled: boolean;
}

export interface AccountingCorrespondenceRule {
  id: string;
  scope: string;
  orgId: string | null;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingOrgOption {
  id: string;
  shortName: string;
}

export interface CounterpartyGroupOption {
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

export async function getAccountingOrgAccounts(
  orgId: string,
): Promise<AccountingOrgAccount[]> {
  const client = await getServerApiClient();
  const res = await client.v1.accounting.orgs[":orgId"].accounts.$get(
    { param: { orgId } },
    { init: { cache: "no-store" } },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch org accounts: ${res.status}`);
  }

  return (await res.json()) as AccountingOrgAccount[];
}

export async function getAccountingCorrespondenceRules(
  orgId: string,
): Promise<AccountingCorrespondenceRule[]> {
  const client = await getServerApiClient();
  const res = await client.v1.accounting.orgs[":orgId"]["correspondence-rules"].$get(
    { param: { orgId } },
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
