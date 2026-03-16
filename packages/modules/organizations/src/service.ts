import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import {
  createCreateOrganizationHandler,
  createRemoveOrganizationHandler,
  createUpdateOrganizationHandler,
} from "./application/organizations/commands";
import type {
  OrganizationsCommandTxRepository,
} from "./application/organizations/ports";
import {
  createFindOrganizationByIdHandler,
  createListOrganizationsHandler,
} from "./application/organizations/queries";
import {
  createGetOrganizationRequisiteAccountingBindingHandler,
  createResolveOrganizationRequisiteBindingsHandler,
  createUpsertOrganizationRequisiteAccountingBindingHandler,
} from "./application/requisites/bindings";
import {
  createCreateOrganizationRequisiteHandler,
  createRemoveOrganizationRequisiteHandler,
  createUpdateOrganizationRequisiteHandler,
} from "./application/requisites/commands";
import type {
  OrganizationRequisitesCommandTxRepository,
} from "./application/requisites/ports";
import {
  createFindOrganizationRequisiteByIdHandler,
  createListOrganizationRequisiteOptionsHandler,
  createListOrganizationRequisitesHandler,
} from "./application/requisites/queries";
import {
  createOrganizationsServiceContext,
} from "./application/shared/context";
import type {
  OrganizationsCurrenciesPort,
  OrganizationsRequisiteProvidersPort,
  OrganizationsTransactionsPort,
} from "./application/shared/external-ports";
import {
  createDrizzleOrganizationRequisitesCommandRepository,
  createDrizzleOrganizationRequisitesQueryRepository,
} from "./infra/drizzle/repos/organization-requisites-repository";
import {
  createDrizzleOrganizationsCommandRepository,
  createDrizzleOrganizationsQueryRepository,
} from "./infra/drizzle/repos/organizations-repository";

export type OrganizationsService = ReturnType<
  typeof createOrganizationsService
>;

export interface OrganizationsLedgerBooksPort {
  ensureDefaultOrganizationBook: (
    tx: Transaction,
    input: { organizationId: string },
  ) => Promise<{ bookId: string }>;
}

export interface OrganizationsLedgerBindingsPort {
  ensureOrganizationPostingTarget: (
    tx: Transaction,
    input: {
      organizationId: string;
      currencyCode: string;
      postingAccountNo: string;
    },
  ) => Promise<{
    bookId: string;
    bookAccountInstanceId: string;
  }>;
}

export interface OrganizationsServiceDeps {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  ledgerBooks: OrganizationsLedgerBooksPort;
  currencies: OrganizationsCurrenciesPort;
  ledgerBindings: OrganizationsLedgerBindingsPort;
  requisiteProviders: OrganizationsRequisiteProvidersPort;
}

function createOrganizationsTxRepository(input: {
  organizations: ReturnType<typeof createDrizzleOrganizationsCommandRepository>;
  tx: Transaction;
}): OrganizationsCommandTxRepository {
  return {
    findOrganizationSnapshotById(id) {
      return input.organizations.findOrganizationSnapshotById(id, input.tx);
    },
    insertOrganization(organization) {
      return input.organizations.insertOrganizationTx(input.tx, organization);
    },
    updateOrganization(organization) {
      return input.organizations.updateOrganizationTx(input.tx, organization);
    },
    removeOrganization(id) {
      return input.organizations.removeOrganizationTx(input.tx, id);
    },
  };
}

function createOrganizationRequisitesTxRepository(input: {
  requisites: ReturnType<
    typeof createDrizzleOrganizationRequisitesCommandRepository
  >;
  tx: Transaction;
}): OrganizationRequisitesCommandTxRepository {
  return {
    findRequisiteSnapshotById(id) {
      return input.requisites.findRequisiteSnapshotById(id, input.tx);
    },
    findActiveRequisiteSnapshotById(id) {
      return input.requisites.findActiveRequisiteSnapshotById(id, input.tx);
    },
    listActiveRequisitesByOrganizationCurrency(params) {
      return input.requisites.listActiveRequisitesByOrganizationCurrency(
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
    findBindingByRequisiteId(requisiteId) {
      return input.requisites.findBindingByRequisiteId(requisiteId, input.tx);
    },
    upsertBinding(params) {
      return input.requisites.upsertBindingTx(input.tx, params);
    },
  };
}

function createOrganizationsTransactions(input: {
  db: Database;
  organizations: ReturnType<typeof createDrizzleOrganizationsCommandRepository>;
  requisites: ReturnType<
    typeof createDrizzleOrganizationRequisitesCommandRepository
  >;
  ledgerBooks: OrganizationsLedgerBooksPort;
  ledgerBindings: OrganizationsLedgerBindingsPort;
}): OrganizationsTransactionsPort {
  return {
    async withTransaction(run) {
      return input.db.transaction(async (tx: Transaction) =>
        run({
          organizations: createOrganizationsTxRepository({
            organizations: input.organizations,
            tx,
          }),
          requisites: createOrganizationRequisitesTxRepository({
            requisites: input.requisites,
            tx,
          }),
          ledgerBooks: {
            ensureDefaultOrganizationBook(params) {
              return input.ledgerBooks.ensureDefaultOrganizationBook(tx, params);
            },
          },
          ledgerBindings: {
            ensureOrganizationPostingTarget(params) {
              return input.ledgerBindings.ensureOrganizationPostingTarget(
                tx,
                params,
              );
            },
          },
        }),
      );
    },
  };
}

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const organizations = createDrizzleOrganizationsCommandRepository(deps.db);
  const requisites = createDrizzleOrganizationRequisitesCommandRepository(deps.db);
  const context = createOrganizationsServiceContext({
    logger: deps.logger,
    now: deps.now,
    currencies: deps.currencies,
    requisiteProviders: deps.requisiteProviders,
    organizationQueries: createDrizzleOrganizationsQueryRepository(deps.db),
    requisiteQueries: createDrizzleOrganizationRequisitesQueryRepository(
      deps.db,
    ),
    transactions: createOrganizationsTransactions({
      db: deps.db,
      organizations,
      requisites,
      ledgerBooks: deps.ledgerBooks,
      ledgerBindings: deps.ledgerBindings,
    }),
  });

  return {
    list: createListOrganizationsHandler(context),
    findById: createFindOrganizationByIdHandler(context),
    create: createCreateOrganizationHandler(context),
    update: createUpdateOrganizationHandler(context),
    remove: createRemoveOrganizationHandler(context),
    requisites: {
      list: createListOrganizationRequisitesHandler(context),
      listOptions: createListOrganizationRequisiteOptionsHandler(context),
      findById: createFindOrganizationRequisiteByIdHandler(context),
      create: createCreateOrganizationRequisiteHandler(context),
      update: createUpdateOrganizationRequisiteHandler(context),
      remove: createRemoveOrganizationRequisiteHandler(context),
      getBinding:
        createGetOrganizationRequisiteAccountingBindingHandler(context),
      upsertBinding:
        createUpsertOrganizationRequisiteAccountingBindingHandler(context),
      resolveBindings:
        createResolveOrganizationRequisiteBindingsHandler(context),
    },
  };
}
