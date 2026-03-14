import type { Database, Transaction } from "@bedrock/platform/persistence";

import {
  assertBooksBelongToInternalLedgerOrganizations,
  assertInternalLedgerOrganization,
  isInternalLedgerOrganization,
  listInternalLedgerOrganizations,
} from "./internal-ledger";

type Queryable = Database | Transaction;

export interface OrganizationsQueries {
  listInternalLedgerOrganizations: () => Promise<
    {
      id: string;
      shortName: string;
    }[]
  >;
  listInternalLedgerOrganizationIds: () => Promise<string[]>;
  isInternalLedgerOrganization: (organizationId: string) => Promise<boolean>;
  assertInternalLedgerOrganization: (organizationId: string) => Promise<void>;
  assertBooksBelongToInternalLedgerOrganizations: (
    bookIds: string[],
  ) => Promise<void>;
}

export function createOrganizationsQueries(input: { db: Queryable }): OrganizationsQueries {
  const { db } = input;

  return {
    async listInternalLedgerOrganizations() {
      return listInternalLedgerOrganizations(db);
    },
    async listInternalLedgerOrganizationIds() {
      const rows = await listInternalLedgerOrganizations(db);
      return rows.map((row) => row.id);
    },
    async isInternalLedgerOrganization(organizationId: string) {
      return isInternalLedgerOrganization({
        db,
        organizationId,
      });
    },
    async assertInternalLedgerOrganization(organizationId: string) {
      await assertInternalLedgerOrganization({
        db,
        organizationId,
      });
    },
    async assertBooksBelongToInternalLedgerOrganizations(bookIds: string[]) {
      await assertBooksBelongToInternalLedgerOrganizations({
        db,
        bookIds,
      });
    },
  };
}
