import type { Transaction } from "@bedrock/platform/persistence";

export interface EnsureDefaultOrganizationBookInput {
  organizationId: string;
}

export interface LedgerBooksPort {
  ensureDefaultOrganizationBookTx: (
    tx: Transaction,
    input: EnsureDefaultOrganizationBookInput,
  ) => Promise<{ bookId: string }>;
}
