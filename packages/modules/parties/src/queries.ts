import type { Queryable } from "@bedrock/platform/persistence";

import { DrizzleCounterpartiesQueries } from "./counterparties/adapters/drizzle/counterparties.queries";
import { DrizzleCustomersQueries } from "./customers/adapters/drizzle/customers.queries";
import { DrizzleOrganizationsQueries } from "./organizations/adapters/drizzle/organizations.queries";
import { DrizzleRequisitesQueries } from "./requisites/adapters/drizzle/requisites.queries";

export interface PartiesQueries {
  counterparties: {
    listAssignmentsByCounterpartyIds(
      counterpartyIds: string[],
    ): Promise<
      Map<
        string,
        {
          counterpartyId: string;
          subAgentCounterpartyId: string | null;
        }
      >
    >;
    listGroupMembers(input: {
      groupIds: string[];
      includeDescendants: boolean;
    }): Promise<
      {
        rootGroupId: string;
        counterpartyId: string;
      }[]
    >;
    listShortNamesById(ids: string[]): Promise<Map<string, string>>;
    searchCustomerOwnedCounterparties(input: {
      limit: number;
      offset: number;
      q: string;
    }): Promise<
      {
        counterpartyId: string;
        customerId: string | null;
        inn: string | null;
        orgName: string;
        shortName: string;
      }[]
    >;
    upsertAssignment(input: {
      counterpartyId: string;
      subAgentCounterpartyId: string | null;
    }): Promise<void>;
  };
  customers: {
    listNamesById(ids: string[]): Promise<Map<string, string>>;
  };
  organizations: {
    assertBooksBelongToInternalLedgerOrganizations(bookIds: string[]): Promise<void>;
    assertInternalLedgerOrganization(organizationId: string): Promise<void>;
    isInternalLedgerOrganization(organizationId: string): Promise<boolean>;
    listInternalLedgerOrganizations(): Promise<
      {
        id: string;
        shortName: string;
      }[]
    >;
    listInternalLedgerOrganizationIds(): Promise<string[]>;
    listShortNamesById(ids: string[]): Promise<Map<string, string>>;
  };
  requisites: {
    findById(
      id: string,
    ): ReturnType<DrizzleRequisitesQueries["findById"]>;
    bindings: {
      findByRequisiteId(
        requisiteId: string,
      ): ReturnType<DrizzleRequisitesQueries["bindings"]["findByRequisiteId"]>;
      listByRequisiteId(
        requisiteIds: string[],
      ): ReturnType<DrizzleRequisitesQueries["bindings"]["listByRequisiteId"]>;
    };
    listLabelsById(ids: string[]): Promise<Map<string, string>>;
    listOptions(
      input: Parameters<DrizzleRequisitesQueries["listOptions"]>[0],
    ): ReturnType<DrizzleRequisitesQueries["listOptions"]>;
    providers: {
      findById(
        id: string,
      ): ReturnType<DrizzleRequisitesQueries["providers"]["findById"]>;
    };
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
      listAssignmentsByCounterpartyIds:
        counterparties.listAssignmentsByCounterpartyIds.bind(counterparties),
      listGroupMembers:
        counterparties.listGroupMembers.bind(counterparties),
      listShortNamesById:
        counterparties.listShortNamesById.bind(counterparties),
      searchCustomerOwnedCounterparties:
        counterparties.searchCustomerOwnedCounterparties.bind(counterparties),
      upsertAssignment:
        counterparties.upsertAssignment.bind(counterparties),
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
      listInternalLedgerOrganizations:
        organizations.listInternalLedgerOrganizations.bind(organizations),
      listInternalLedgerOrganizationIds:
        organizations.listInternalLedgerOrganizationIds.bind(organizations),
      listShortNamesById:
        organizations.listShortNamesById.bind(organizations),
    },
    requisites: {
      findById: requisites.findById.bind(requisites),
      bindings: {
        findByRequisiteId:
          requisites.bindings.findByRequisiteId.bind(requisites.bindings),
        listByRequisiteId:
          requisites.bindings.listByRequisiteId.bind(requisites.bindings),
      },
      listLabelsById: requisites.listLabelsById.bind(requisites),
      listOptions: requisites.listOptions.bind(requisites),
      providers: {
        findById: requisites.providers.findById.bind(requisites.providers),
      },
    },
  };
}
