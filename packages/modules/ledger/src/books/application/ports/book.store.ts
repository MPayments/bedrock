export interface EnsureDefaultOrganizationBookInput {
  organizationId: string;
}

export interface LedgerBookStore {
  ensureDefaultOrganizationBook: (
    input: EnsureDefaultOrganizationBookInput,
  ) => Promise<{ bookId: string }>;
}
