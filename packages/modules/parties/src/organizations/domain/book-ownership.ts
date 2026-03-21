import { dedupeStrings as dedupeIds } from "@bedrock/shared/core/domain";

export interface OrganizationLedgerBookRow {
  id: string;
  ownerId: string | null;
}

export interface OrganizationBookOwnershipViolation {
  bookId: string;
  ownerId: string | null;
}

export interface OrganizationBookOwnershipViolations {
  missingBookIds: string[];
  nonOrganizationOwners: OrganizationBookOwnershipViolation[];
}

export function findOrganizationBookOwnershipViolations(input: {
  bookIds: string[];
  books: OrganizationLedgerBookRow[];
  organizationIds: string[];
}): OrganizationBookOwnershipViolations {
  const bookIds = dedupeIds(input.bookIds);
  const rowByBookId = new Map(input.books.map((row) => [row.id, row]));
  const organizationIds = new Set(input.organizationIds);
  const missingBookIds: string[] = [];
  const nonOrganizationOwners: OrganizationBookOwnershipViolation[] = [];

  for (const bookId of bookIds) {
    const row = rowByBookId.get(bookId);
    if (!row) {
      missingBookIds.push(bookId);
      continue;
    }

    if (!row.ownerId || !organizationIds.has(row.ownerId)) {
      nonOrganizationOwners.push({
        bookId,
        ownerId: row.ownerId,
      });
    }
  }

  return {
    missingBookIds,
    nonOrganizationOwners,
  };
}
