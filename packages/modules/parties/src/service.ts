import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database, PersistenceContext, Transaction } from "@bedrock/platform/persistence";

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
  createPartiesServiceContext,
} from "./application/shared/context";
import type {
  PartiesDocumentsReadPort,
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
  createDrizzleCustomersCommandRepository,
  createDrizzleCustomersQueryRepository,
} from "./infra/drizzle/repos/customers-repository";

export type PartiesService = ReturnType<typeof createPartiesService>;

export { type PartiesDocumentsReadPort };

export interface PartiesServiceDeps {
  persistence: PersistenceContext;
  logger?: Logger;
  now?: () => Date;
  documents: PartiesDocumentsReadPort;
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

function createPartiesTransactions(input: {
  persistence: PersistenceContext;
  customers: ReturnType<typeof createDrizzleCustomersCommandRepository>;
  counterparties: ReturnType<typeof createDrizzleCounterpartiesCommandRepository>;
  groups: ReturnType<typeof createDrizzleCounterpartyGroupsCommandRepository>;
  documents: PartiesDocumentsReadPort;
}): PartiesTransactionsPort {
  return {
    async withTransaction(run) {
      return input.persistence.runInTransaction(async (tx) =>
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
  const db = deps.persistence.db as Database;
  const customers = createDrizzleCustomersCommandRepository(db);
  const counterparties = createDrizzleCounterpartiesCommandRepository(db);
  const groups = createDrizzleCounterpartyGroupsCommandRepository(db);
  const context = createPartiesServiceContext({
    logger: deps.logger,
    now: deps.now,
    customerQueries: createDrizzleCustomersQueryRepository(db),
    counterparties,
    counterpartyQueries: createDrizzleCounterpartiesQueryRepository(db),
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
    groupQueries: createDrizzleCounterpartyGroupsQueryRepository(db),
    transactions: createPartiesTransactions({
      persistence: deps.persistence,
      customers,
      counterparties,
      groups,
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
  };
}
