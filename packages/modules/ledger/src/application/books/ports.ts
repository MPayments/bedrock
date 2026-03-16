import type { PersistenceSession } from "@bedrock/shared/core/persistence";

export interface EnsureDefaultOrganizationBookInput {
  organizationId: string;
}

export interface LedgerBooksPort {
  ensureDefaultOrganizationBookTx: (
    tx: PersistenceSession,
    input: EnsureDefaultOrganizationBookInput,
  ) => Promise<{ bookId: string }>;
}
