import { createLedgerQueries } from "@bedrock/ledger/queries";
import type { Database } from "@bedrock/platform/persistence";

import {
  createOrganizationQueries,
  type OrganizationsQueries,
} from "./application/internal-ledger/queries";
import {
  createDrizzleOrganizationsQueryRepository,
} from "./infra/drizzle/repos/organizations-repository";

export function createOrganizationsQueries(input: {
  db: Database;
}): OrganizationsQueries {
  const organizations = createDrizzleOrganizationsQueryRepository(input.db);
  const ledgerQueries = createLedgerQueries({ db: input.db });

  return createOrganizationQueries({
    organizations,
    ledgerRead: {
      listBooksById: ledgerQueries.listBooksById,
    },
  });
}

export type { OrganizationsQueries };
