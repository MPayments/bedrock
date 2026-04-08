import type { Queryable } from "@bedrock/platform/persistence";

import { DrizzleCounterpartiesQueries } from "./counterparties/adapters/drizzle/counterparties.queries";
import { DrizzleCustomersQueries } from "./customers/adapters/drizzle/customers.queries";
import { DrizzleOrganizationsQueries } from "./organizations/adapters/drizzle/organizations.queries";
import { DrizzleRequisitesQueries } from "./requisites/adapters/drizzle/requisites.queries";

export interface PartiesQueries {
  counterparties: {
    listShortNamesById(ids: string[]): Promise<Map<string, string>>;
  };
  customers: {
    listNamesById(ids: string[]): Promise<Map<string, string>>;
  };
  organizations: {
    assertBooksBelongToInternalLedgerOrganizations(bookIds: string[]): Promise<void>;
    assertInternalLedgerOrganization(organizationId: string): Promise<void>;
    isInternalLedgerOrganization(organizationId: string): Promise<boolean>;
    listInternalLedgerOrganizationIds(): Promise<string[]>;
    listShortNamesById(ids: string[]): Promise<Map<string, string>>;
  };
  requisites: {
    bindings: {
      findByRequisiteId(
        requisiteId: string,
      ): ReturnType<DrizzleRequisitesQueries["bindings"]["findByRequisiteId"]>;
      listByRequisiteId(
        requisiteIds: string[],
      ): ReturnType<DrizzleRequisitesQueries["bindings"]["listByRequisiteId"]>;
    };
    listLabelsById(ids: string[]): Promise<Map<string, string>>;
  };
}

export function createPartiesQueries(input: {
  db: Queryable;
}): PartiesQueries {
  const customers = new DrizzleCustomersQueries(input.db as never);
  const counterparties = new DrizzleCounterpartiesQueries(input.db as never);
  const organizations = new DrizzleOrganizationsQueries(input.db as never);
  const requisites = new DrizzleRequisitesQueries(input.db as never);

  return {
    counterparties: {
      listShortNamesById:
        counterparties.listShortNamesById.bind(counterparties),
    },
    customers: {
      listNamesById:
        customers.listNamesById.bind(customers),
    },
    organizations: {
      assertBooksBelongToInternalLedgerOrganizations:
        organizations.assertBooksBelongToInternalLedgerOrganizations.bind(
          organizations,
        ),
      assertInternalLedgerOrganization:
        organizations.assertInternalLedgerOrganization.bind(organizations),
      isInternalLedgerOrganization:
        organizations.isInternalLedgerOrganization.bind(organizations),
      listInternalLedgerOrganizationIds:
        organizations.listInternalLedgerOrganizationIds.bind(organizations),
      listShortNamesById:
        organizations.listShortNamesById.bind(organizations),
    },
    requisites: {
      bindings: {
        findByRequisiteId:
          requisites.bindings.findByRequisiteId.bind(requisites.bindings),
        listByRequisiteId:
          requisites.bindings.listByRequisiteId.bind(requisites.bindings),
      },
      listLabelsById: requisites.listLabelsById.bind(requisites),
    },
  };
}
