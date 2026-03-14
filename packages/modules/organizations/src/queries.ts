import { createLedgerQueries } from "@bedrock/ledger/queries";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import {
  createOrganizationQueries,
  type OrganizationsQueries,
} from "./application/internal-ledger/queries";
import { createDrizzleOrganizationsRepository } from "./infra/drizzle/repos/organizations-repository";

type Queryable = Database | Transaction;

export function createOrganizationsQueries(input: { db: Queryable }): OrganizationsQueries {
  const organizations = createDrizzleOrganizationsRepository(input.db);
  const ledgerQueries = createLedgerQueries({ db: input.db });

  return createOrganizationQueries({
    organizations,
    ledgerRead: {
      listBooksById: ledgerQueries.listBooksById,
    },
  });
}

export type { OrganizationsQueries };
