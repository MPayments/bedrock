import type { Transaction } from "@bedrock/platform/persistence";

export interface OrganizationsLedgerBooksPort {
  ensureDefaultOrganizationBook: (
    tx: Transaction,
    input: { organizationId: string },
  ) => Promise<{ bookId: string }>;
}

export interface OrganizationsLedgerReadPort {
  listBooksById: (
    bookIds: string[],
  ) => Promise<
    {
      id: string;
      ownerId: string | null;
    }[]
  >;
}

export interface OrganizationsCurrenciesPort {
  assertCurrencyExists: (id: string) => Promise<void>;
  listCodesById: (ids: string[]) => Promise<Map<string, string>>;
}

export interface OrganizationsRequisiteProvidersPort {
  assertProviderActive: (id: string) => Promise<void>;
}

export interface OrganizationsLedgerBindingsPort {
  ensureOrganizationPostingTarget: (
    tx: Transaction,
    input: {
      organizationId: string;
      currencyCode: string;
      postingAccountNo: string;
    },
  ) => Promise<{
    bookId: string;
    bookAccountInstanceId: string;
  }>;
}
