import { createLedgerQueries } from "@bedrock/ledger/queries";
import type { Queryable } from "@bedrock/platform/persistence";

import {
  createOrganizationQueries,
  type OrganizationsQueries,
} from "./application/internal-ledger/queries";
import { createDrizzleOrganizationsRepository } from "./infra/drizzle/repos/organizations-repository";
import { createDrizzleOrganizationRequisitesRepository } from "./infra/drizzle/repos/organization-requisites-repository";

export function createOrganizationsQueries(input: {
  db: Queryable;
}): OrganizationsQueries {
  const organizations = createDrizzleOrganizationsRepository(input.db);
  const ledgerQueries = createLedgerQueries({ db: input.db });

  return createOrganizationQueries({
    organizations,
    requisites: createDrizzleOrganizationRequisitesRepository(input.db),
    ledgerRead: {
      listBooksById: ledgerQueries.listBooksById,
    },
  });
}

export type { OrganizationsQueries };
