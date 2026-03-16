import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import {
  createCreateCounterpartyHandler,
  createRemoveCounterpartyHandler,
  createUpdateCounterpartyHandler,
} from "./application/counterparties/commands";
import type {
  CounterpartiesCommandTxRepository,
} from "./application/counterparties/ports";
import {
  createFindCounterpartyByIdHandler,
  createListCounterpartiesHandler,
} from "./application/counterparties/queries";
import {
  createCreateCustomerHandler,
  createRemoveCustomerHandler,
  createUpdateCustomerHandler,
} from "./application/customers/commands";
import type {
  CustomersCommandTxRepository,
} from "./application/customers/ports";
import {
  createFindCustomerByIdHandler,
  createListCustomersHandler,
} from "./application/customers/queries";
import {
  createCreateCounterpartyGroupHandler,
  createRemoveCounterpartyGroupHandler,
  createUpdateCounterpartyGroupHandler,
} from "./application/groups/commands";
import type {
  CounterpartyGroupsCommandTxRepository,
} from "./application/groups/ports";
import { createListCounterpartyGroupsHandler } from "./application/groups/queries";
import {
  createCreateCounterpartyRequisiteHandler,
  createRemoveCounterpartyRequisiteHandler,
  createUpdateCounterpartyRequisiteHandler,
} from "./application/requisites/commands";
import type {
  CounterpartyRequisitesCommandTxRepository,
} from "./application/requisites/ports";
import {
  createFindCounterpartyRequisiteByIdHandler,
  createListCounterpartyRequisiteOptionsHandler,
  createListCounterpartyRequisitesHandler,
} from "./application/requisites/queries";
import {
  createPartiesServiceContext,
} from "./application/shared/context";
import type {
  PartiesCurrenciesPort,
  PartiesRequisiteProvidersPort,
  PartiesTransactionsPort,
} from "./application/shared/external-ports";
import {
  createDrizzleCounterpartiesCommandRepository,
  createDrizzleCounterpartiesQueryRepository,
} from "./infra/drizzle/repos/counterparties-repository";
import {
  createDrizzleCounterpartyGroupsCommandRepository,
  createDrizzleCounterpartyGroupsQueryRepository,
} from "./infra/drizzle/repos/counterparty-groups-repository";
import {
  createDrizzleCounterpartyRequisitesCommandRepository,
  createDrizzleCounterpartyRequisitesQueryRepository,
} from "./infra/drizzle/repos/counterparty-requisites-repository";
import {
  createDrizzleCustomersCommandRepository,
  createDrizzleCustomersQueryRepository,
} from "./infra/drizzle/repos/customers-repository";

export type PartiesService = ReturnType<typeof createPartiesService>;

export interface PartiesDocumentsReadPort {
  hasDocumentsForCustomer: (
    customerId: string,
    tx?: Transaction,
  ) => Promise<boolean>;
}

export interface PartiesServiceDeps {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  documents: PartiesDocumentsReadPort;
  currencies: PartiesCurrenciesPort;
  requisiteProviders: PartiesRequisiteProvidersPort;
}

function createCustomersTxRepository(input: {
  customers: ReturnType<typeof createDrizzleCustomersCommandRepository>;
  tx: Transaction;
}): CustomersCommandTxRepository {
  return {
    findCustomerSnapshotById(id) {
      return input.customers.findCustomerSnapshotById(id, input.tx);
    },
    insertCustomer(customer) {
      return input.customers.insertCustomerTx(input.tx, customer);
    },
    updateCustomer(customer) {
      return input.customers.updateCustomerTx(input.tx, customer);
    },
    removeCustomer(id) {
      return input.customers.removeCustomerTx(input.tx, id);
    },
    listExistingCustomerIds(ids) {
      return input.customers.listExistingCustomerIds(ids, input.tx);
    },
    findManagedCustomerGroup(customerId) {
      return input.customers.findManagedCustomerGroup(customerId, input.tx);
    },
    ensureManagedCustomerGroup(params) {
      return input.customers.ensureManagedCustomerGroupTx(input.tx, params);
    },
    renameManagedCustomerGroup(params) {
      return input.customers.renameManagedCustomerGroupTx(input.tx, params);
    },
    listCounterpartiesByCustomerId(customerId) {
      return input.customers.listCounterpartiesByCustomerId(customerId, input.tx);
    },
    listGroupHierarchyNodes() {
      return input.customers.listGroupHierarchyNodes(input.tx);
    },
    listMembershipRowsByCounterpartyIds(counterpartyIds) {
      return input.customers.listMembershipRowsByCounterpartyIds(
        counterpartyIds,
        input.tx,
      );
    },
    deleteMembershipsByCounterpartyAndGroupIds(params) {
      return input.customers.deleteMembershipsByCounterpartyAndGroupIdsTx(
        input.tx,
        params,
      );
    },
    clearCounterpartyCustomerLink(counterpartyIds) {
      return input.customers.clearCounterpartyCustomerLinkTx(
        input.tx,
        counterpartyIds,
      );
    },
    deleteCounterpartyGroupsByIds(groupIds) {
      return input.customers.deleteCounterpartyGroupsByIdsTx(input.tx, groupIds);
    },
  };
}

function createCounterpartiesTxRepository(input: {
  counterparties: ReturnType<typeof createDrizzleCounterpartiesCommandRepository>;
  tx: Transaction;
}): CounterpartiesCommandTxRepository {
  return {
    findCounterpartySnapshotById(id) {
      return input.counterparties.findCounterpartySnapshotById(id, input.tx);
    },
    insertCounterparty(counterparty) {
      return input.counterparties.insertCounterpartyTx(input.tx, counterparty);
    },
    updateCounterparty(counterparty) {
      return input.counterparties.updateCounterpartyTx(input.tx, counterparty);
    },
    replaceMemberships(counterpartyId, groupIds) {
      return input.counterparties.replaceMembershipsTx(
        input.tx,
        counterpartyId,
        groupIds,
      );
    },
    listGroupHierarchyNodes() {
      return input.counterparties.listGroupHierarchyNodes(input.tx);
    },
  };
}

function createCounterpartyGroupsTxRepository(input: {
  groups: ReturnType<typeof createDrizzleCounterpartyGroupsCommandRepository>;
  tx: Transaction;
}): CounterpartyGroupsCommandTxRepository {
  return {
    findCounterpartyGroupSnapshotById(id) {
      return input.groups.findCounterpartyGroupSnapshotById(id, input.tx);
    },
    reparentCounterpartyChildren(params) {
      return input.groups.reparentCounterpartyChildrenTx(input.tx, params);
    },
    removeCounterpartyGroup(id) {
      return input.groups.removeCounterpartyGroupTx(input.tx, id);
    },
  };
}

function createCounterpartyRequisitesTxRepository(input: {
  requisites: ReturnType<
    typeof createDrizzleCounterpartyRequisitesCommandRepository
  >;
  tx: Transaction;
}): CounterpartyRequisitesCommandTxRepository {
  return {
    findActiveRequisiteSnapshotById(id) {
      return input.requisites.findActiveRequisiteSnapshotById(id, input.tx);
    },
    listActiveRequisitesByCounterpartyCurrency(params) {
      return input.requisites.listActiveRequisitesByCounterpartyCurrency(
        params,
        input.tx,
      );
    },
    insertRequisite(requisite) {
      return input.requisites.insertRequisiteTx(input.tx, requisite);
    },
    updateRequisite(requisite) {
      return input.requisites.updateRequisiteTx(input.tx, requisite);
    },
    setDefaultState(params) {
      return input.requisites.setDefaultStateTx(input.tx, params);
    },
    archiveRequisite(params) {
      return input.requisites.archiveRequisiteTx(input.tx, params);
    },
  };
}

function createPartiesTransactions(input: {
  db: Database;
  customers: ReturnType<typeof createDrizzleCustomersCommandRepository>;
  counterparties: ReturnType<typeof createDrizzleCounterpartiesCommandRepository>;
  groups: ReturnType<typeof createDrizzleCounterpartyGroupsCommandRepository>;
  requisites: ReturnType<
    typeof createDrizzleCounterpartyRequisitesCommandRepository
  >;
  documents: PartiesDocumentsReadPort;
}): PartiesTransactionsPort {
  return {
    async withTransaction(run) {
      return input.db.transaction(async (tx: Transaction) =>
        run({
          customers: createCustomersTxRepository({
            customers: input.customers,
            tx,
          }),
          counterparties: createCounterpartiesTxRepository({
            counterparties: input.counterparties,
            tx,
          }),
          groups: createCounterpartyGroupsTxRepository({
            groups: input.groups,
            tx,
          }),
          requisites: createCounterpartyRequisitesTxRepository({
            requisites: input.requisites,
            tx,
          }),
          documents: {
            hasDocumentsForCustomer(customerId) {
              return input.documents.hasDocumentsForCustomer(customerId, tx);
            },
          },
        }),
      );
    },
  };
}

export function createPartiesService(deps: PartiesServiceDeps) {
  const customers = createDrizzleCustomersCommandRepository(deps.db);
  const counterparties = createDrizzleCounterpartiesCommandRepository(deps.db);
  const groups = createDrizzleCounterpartyGroupsCommandRepository(deps.db);
  const requisites = createDrizzleCounterpartyRequisitesCommandRepository(deps.db);
  const context = createPartiesServiceContext({
    logger: deps.logger,
    now: deps.now,
    currencies: deps.currencies,
    requisiteProviders: deps.requisiteProviders,
    customerQueries: createDrizzleCustomersQueryRepository(deps.db),
    counterparties,
    counterpartyQueries: createDrizzleCounterpartiesQueryRepository(deps.db),
    groups: {
      findCounterpartyGroupSnapshotById(id) {
        return groups.findCounterpartyGroupSnapshotById(id);
      },
      insertCounterpartyGroup(group) {
        return groups.insertCounterpartyGroup(group);
      },
      updateCounterpartyGroup(group) {
        return groups.updateCounterpartyGroup(group);
      },
      listGroupHierarchyNodes() {
        return groups.listGroupHierarchyNodes();
      },
    },
    groupQueries: createDrizzleCounterpartyGroupsQueryRepository(deps.db),
    requisiteQueries: createDrizzleCounterpartyRequisitesQueryRepository(
      deps.db,
    ),
    transactions: createPartiesTransactions({
      db: deps.db,
      customers,
      counterparties,
      groups,
      requisites,
      documents: deps.documents,
    }),
  });

  return {
    customers: {
      list: createListCustomersHandler(context),
      findById: createFindCustomerByIdHandler(context),
      create: createCreateCustomerHandler(context),
      update: createUpdateCustomerHandler(context),
      remove: createRemoveCustomerHandler(context),
    },
    counterparties: {
      list: createListCounterpartiesHandler(context),
      findById: createFindCounterpartyByIdHandler(context),
      create: createCreateCounterpartyHandler(context),
      update: createUpdateCounterpartyHandler(context),
      remove: createRemoveCounterpartyHandler(context),
    },
    groups: {
      list: createListCounterpartyGroupsHandler(context),
      create: createCreateCounterpartyGroupHandler(context),
      update: createUpdateCounterpartyGroupHandler(context),
      remove: createRemoveCounterpartyGroupHandler(context),
    },
    requisites: {
      list: createListCounterpartyRequisitesHandler(context),
      listOptions: createListCounterpartyRequisiteOptionsHandler(context),
      findById: createFindCounterpartyRequisiteByIdHandler(context),
      create: createCreateCounterpartyRequisiteHandler(context),
      update: createUpdateCounterpartyRequisiteHandler(context),
      remove: createRemoveCounterpartyRequisiteHandler(context),
    },
  };
}
