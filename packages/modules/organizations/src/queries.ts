import { createLedgerQueries } from "@bedrock/ledger/queries";
import type { Database } from "@bedrock/platform/persistence";

import {
  createOrganizationQueries,
  type OrganizationsQueries,
} from "./application/internal-ledger/queries";
import {
  createDrizzleOrganizationRequisitesQueryRepository,
} from "./infra/drizzle/repos/organization-requisites-repository";
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
    requisites: createDrizzleOrganizationRequisitesQueryRepository(input.db),
    ledgerRead: {
      listBooksById: ledgerQueries.listBooksById,
    },
  });
}

export type { OrganizationsQueries };
