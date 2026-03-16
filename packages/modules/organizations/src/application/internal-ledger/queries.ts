import {
  findOrganizationBookOwnershipViolations,
} from "../../domain/book-ownership";
import {
  OrganizationInternalLedgerInvariantError,
  OrganizationNotFoundError,
} from "../../errors";
import type { OrganizationsQueryRepository } from "../organizations/ports";
import type {
  OrganizationsLedgerReadPort,
} from "../shared/external-ports";

export interface OrganizationsQueries {
  listInternalLedgerOrganizations: () => Promise<
    {
      id: string;
      shortName: string;
    }[]
  >;
  listShortNamesById: (ids: string[]) => Promise<Map<string, string>>;
  listInternalLedgerOrganizationIds: () => Promise<string[]>;
  isInternalLedgerOrganization: (organizationId: string) => Promise<boolean>;
  assertInternalLedgerOrganization: (organizationId: string) => Promise<void>;
  assertBooksBelongToInternalLedgerOrganizations: (
    bookIds: string[],
  ) => Promise<void>;
}

export function createOrganizationQueries(input: {
  organizations: OrganizationsQueryRepository;
  ledgerRead: OrganizationsLedgerReadPort;
}): OrganizationsQueries {
  const { ledgerRead, organizations } = input;

  return {
    async listInternalLedgerOrganizations() {
      return organizations.listInternalLedgerOrganizations();
    },
    async listShortNamesById(ids: string[]) {
      return organizations.listShortNamesById(ids);
    },
    async listInternalLedgerOrganizationIds() {
      const rows = await organizations.listInternalLedgerOrganizations();
      return rows.map((row) => row.id);
    },
    async isInternalLedgerOrganization(organizationId: string) {
      const ids = await organizations.listExistingOrganizationIds([
        organizationId,
      ]);
      return ids.includes(organizationId);
    },
    async assertInternalLedgerOrganization(organizationId: string) {
      const exists = await organizations.listExistingOrganizationIds([
        organizationId,
      ]);

      if (!exists.includes(organizationId)) {
        throw new OrganizationNotFoundError(organizationId);
      }
    },
    async assertBooksBelongToInternalLedgerOrganizations(bookIds: string[]) {
      const uniqueBookIds = Array.from(new Set(bookIds.filter(Boolean)));
      if (uniqueBookIds.length === 0) {
        return;
      }

      const books = await ledgerRead.listBooksById(uniqueBookIds);
      const ownerIds = Array.from(
        new Set(books.map((book) => book.ownerId).filter(Boolean)),
      ) as string[];
      const organizationIds =
        await organizations.listExistingOrganizationIds(ownerIds);
      const violations = findOrganizationBookOwnershipViolations({
        bookIds: uniqueBookIds,
        books,
        organizationIds,
      });

      if (violations.missingBookIds.length > 0) {
        throw new OrganizationInternalLedgerInvariantError(
          `Ledger book does not exist: ${violations.missingBookIds[0]}`,
        );
      }

      if (violations.nonOrganizationOwners.length > 0) {
        const violation = violations.nonOrganizationOwners[0]!;
        throw new OrganizationInternalLedgerInvariantError(
          `Ledger book ${violation.bookId} is owned by non-organization ${violation.ownerId}`,
        );
      }
    },
  };
}
