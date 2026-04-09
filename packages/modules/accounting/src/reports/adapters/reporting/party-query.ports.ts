export interface AccountingOrganizationsQueryPort {
  assertInternalLedgerOrganization(organizationId: string): Promise<void>;
  assertBooksBelongToInternalLedgerOrganizations(bookIds: string[]): Promise<void>;
  listInternalLedgerOrganizationIds(): Promise<string[]>;
  listShortNamesById(ids: string[]): Promise<Map<string, string>>;
}

export interface AccountingCounterpartiesQueryPort {
  listGroupMembers(input: {
    groupIds: string[];
    includeDescendants: boolean;
  }): Promise<
    {
      rootGroupId: string;
      counterpartyId: string;
    }[]
  >;
  listShortNamesById(ids: string[]): Promise<Map<string, string>>;
}

export interface AccountingCustomersQueryPort {
  listNamesById(ids: string[]): Promise<Map<string, string>>;
}

export interface AccountingRequisitesQueryPort {
  listLabelsById(ids: string[]): Promise<Map<string, string>>;
}
