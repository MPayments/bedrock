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
  syncOrganizationRequisiteAccountingBinding,
} from "./application/requisites/bindings";
import type {
  OrganizationRequisiteBindingsCommandTxRepository,
  OrganizationsRequisiteSubjectsPort,
} from "./application/requisites/ports";
import {
  createOrganizationsServiceContext,
} from "./application/shared/context";
import type {
  OrganizationsTransactionsPort,
} from "./application/shared/external-ports";
import {
  createDrizzleOrganizationRequisiteBindingsCommandRepository,
  createDrizzleOrganizationRequisiteBindingsQueryRepository,
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
  ledgerBindings: OrganizationsLedgerBindingsPort;
  requisiteSubjects: OrganizationsRequisiteSubjectsPort;
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

function createOrganizationRequisiteBindingsTxRepository(input: {
  bindings: ReturnType<
    typeof createDrizzleOrganizationRequisiteBindingsCommandRepository
  >;
  tx: Transaction;
}): OrganizationRequisiteBindingsCommandTxRepository {
  return {
    upsertBinding(params) {
      return input.bindings.upsertBindingTx(input.tx, params);
    },
  };
}

function createOrganizationsTransactions(input: {
  db: Database;
  organizations: ReturnType<typeof createDrizzleOrganizationsCommandRepository>;
  requisiteBindings: ReturnType<
    typeof createDrizzleOrganizationRequisiteBindingsCommandRepository
  >;
  ledgerBooks: OrganizationsLedgerBooksPort;
  ledgerBindings: OrganizationsLedgerBindingsPort;
}): OrganizationsTransactionsPort {
  return {
    async withTransaction(run) {
      return input.db.transaction(async (tx: Transaction) =>
        run({
          tx,
          organizations: createOrganizationsTxRepository({
            organizations: input.organizations,
            tx,
          }),
          requisiteBindings: createOrganizationRequisiteBindingsTxRepository({
            bindings: input.requisiteBindings,
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
  const requisiteBindings =
    createDrizzleOrganizationRequisiteBindingsCommandRepository(deps.db);
  const context = createOrganizationsServiceContext({
    logger: deps.logger,
    now: deps.now,
    organizationQueries: createDrizzleOrganizationsQueryRepository(deps.db),
    requisiteSubjects: deps.requisiteSubjects,
    requisiteBindingQueries:
      createDrizzleOrganizationRequisiteBindingsQueryRepository(deps.db),
    transactions: createOrganizationsTransactions({
      db: deps.db,
      organizations,
      requisiteBindings,
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
    requisiteBindings: {
      get: createGetOrganizationRequisiteAccountingBindingHandler(context),
      upsert:
        createUpsertOrganizationRequisiteAccountingBindingHandler(context),
      resolve: createResolveOrganizationRequisiteBindingsHandler(context),
      sync: (
        tx: Transaction,
        input: {
          requisiteId: string;
          organizationId: string;
          currencyCode: string;
          postingAccountNo?: string;
        },
      ) =>
        syncOrganizationRequisiteAccountingBinding(context, {
          tx,
          organizations: createOrganizationsTxRepository({
            organizations,
            tx,
          }),
          requisiteBindings: createOrganizationRequisiteBindingsTxRepository({
            bindings: requisiteBindings,
            tx,
          }),
          ledgerBooks: {
            ensureDefaultOrganizationBook(params) {
              return deps.ledgerBooks.ensureDefaultOrganizationBook(tx, params);
            },
          },
          ledgerBindings: {
            ensureOrganizationPostingTarget(params) {
              return deps.ledgerBindings.ensureOrganizationPostingTarget(
                tx,
                params,
              );
            },
          },
        }, input),
    },
  };
}
