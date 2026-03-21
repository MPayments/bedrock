import { inArray } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";

import { DrizzleOrganizationReads } from "./organization.reads";
import { ledgerBooks } from "./schema";
import {
  OrganizationInternalLedgerInvariantError,
  OrganizationNotFoundError,
} from "../../application/errors";
import {
  findOrganizationBookOwnershipViolations,
  type OrganizationLedgerBookRow,
} from "../../domain/book-ownership";

export interface OrganizationsQueries {
  listInternalLedgerOrganizations(): Promise<
    {
      id: string;
      shortName: string;
    }[]
  >;
  listShortNamesById(ids: string[]): Promise<Map<string, string>>;
  listInternalLedgerOrganizationIds(): Promise<string[]>;
  isInternalLedgerOrganization(organizationId: string): Promise<boolean>;
  assertInternalLedgerOrganization(organizationId: string): Promise<void>;
  assertBooksBelongToInternalLedgerOrganizations(bookIds: string[]): Promise<void>;
}

function dedupeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}

export class DrizzleOrganizationsQueries implements OrganizationsQueries {
  private readonly organizationReads: DrizzleOrganizationReads;

  constructor(private readonly db: Database) {
    this.organizationReads = new DrizzleOrganizationReads(db);
  }

  listInternalLedgerOrganizations() {
    return this.organizationReads.listInternalLedgerOrganizations();
  }

  listShortNamesById(ids: string[]) {
    return this.organizationReads.listShortNamesById(ids);
  }

  async listInternalLedgerOrganizationIds(): Promise<string[]> {
    const rows = await this.organizationReads.listInternalLedgerOrganizations();
    return rows.map((row) => row.id);
  }

  async isInternalLedgerOrganization(organizationId: string): Promise<boolean> {
    const ids = await this.organizationReads.listExistingOrganizationIds([
      organizationId,
    ]);

    return ids.includes(organizationId);
  }

  async assertInternalLedgerOrganization(organizationId: string): Promise<void> {
    const ids = await this.organizationReads.listExistingOrganizationIds([
      organizationId,
    ]);

    if (!ids.includes(organizationId)) {
      throw new OrganizationNotFoundError(organizationId);
    }
  }

  async assertBooksBelongToInternalLedgerOrganizations(
    bookIds: string[],
  ): Promise<void> {
    const uniqueBookIds = dedupeIds(bookIds.filter(Boolean));
    if (uniqueBookIds.length === 0) {
      return;
    }

    const bookRows = await this.db
      .select({
        id: ledgerBooks.id,
        ownerId: ledgerBooks.ownerId,
      })
      .from(ledgerBooks)
      .where(inArray(ledgerBooks.id, uniqueBookIds));
    const ownerIds = dedupeIds(
      bookRows.map((book) => book.ownerId).filter(Boolean) as string[],
    );
    const organizationIds =
      await this.organizationReads.listExistingOrganizationIds(ownerIds);
    const violations = findOrganizationBookOwnershipViolations({
      bookIds: uniqueBookIds,
      books: bookRows satisfies OrganizationLedgerBookRow[],
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
  }
}
