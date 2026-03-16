import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  Queryable,
  Transaction,
} from "@bedrock/platform/persistence";

import {
  createCreateOrganizationHandler,
  createRemoveOrganizationHandler,
  createUpdateOrganizationHandler,
} from "./application/organizations/commands";
import type { OrganizationsCommandTxRepository } from "./application/organizations/ports";
import {
  createFindOrganizationByIdHandler,
  createListOrganizationsHandler,
} from "./application/organizations/queries";
import { createOrganizationsServiceContext } from "./application/shared/context";
import type { OrganizationsTransactionsPort } from "./application/shared/external-ports";
import {
  createDrizzleOrganizationsCommandRepository,
  createDrizzleOrganizationsQueryRepository,
} from "./infra/drizzle/repos/organizations-repository";

export type OrganizationsService = ReturnType<
  typeof createOrganizationsService
>;

export interface OrganizationsServiceDeps {
  db: Queryable;
  logger?: Logger;
  now?: () => Date;
  withTransaction?: OrganizationsTransactionsPort["withTransaction"];
}

export interface OrganizationsServiceTransactionDeps {
  tx: Transaction;
  logger?: Logger;
  now?: () => Date;
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

function createOrganizationsTransactions(input: {
  db: Queryable;
  organizations: ReturnType<typeof createDrizzleOrganizationsCommandRepository>;
  withTransaction?: OrganizationsTransactionsPort["withTransaction"];
}): OrganizationsTransactionsPort {
  if (input.withTransaction) {
    return {
      withTransaction: input.withTransaction,
    };
  }

  return {
    async withTransaction(run) {
      return (input.db as Database).transaction(async (tx: Transaction) =>
        run({
          tx,
          organizations: createOrganizationsTxRepository({
            organizations: input.organizations,
            tx,
          }),
        }),
      );
    },
  };
}

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  const organizations = createDrizzleOrganizationsCommandRepository(deps.db);
  return createOrganizationsServiceContextHandlers({
    logger: deps.logger,
    now: deps.now,
    db: deps.db,
    organizations,
    transactions: createOrganizationsTransactions({
      db: deps.db,
      organizations,
      withTransaction: deps.withTransaction,
    }),
  });
}

export function createOrganizationsServiceFromTransaction(
  deps: OrganizationsServiceTransactionDeps,
) {
  const organizations = createDrizzleOrganizationsCommandRepository(deps.tx);

  return createOrganizationsServiceContextHandlers({
    logger: deps.logger,
    now: deps.now,
    db: deps.tx,
    organizations,
    transactions: {
      withTransaction: (run) =>
        run({
          tx: deps.tx,
          organizations: createOrganizationsTxRepository({
            organizations,
            tx: deps.tx,
          }),
        }),
    },
  });
}

function createOrganizationsServiceContextHandlers(input: {
  db: Queryable;
  logger?: Logger;
  now?: () => Date;
  organizations: ReturnType<typeof createDrizzleOrganizationsCommandRepository>;
  transactions: OrganizationsTransactionsPort;
}) {
  const context = createOrganizationsServiceContext({
    logger: input.logger,
    now: input.now,
    organizationQueries: createDrizzleOrganizationsQueryRepository(input.db),
    transactions: input.transactions,
  });

  return {
    list: createListOrganizationsHandler(context),
    findById: createFindOrganizationByIdHandler(context),
    create: createCreateOrganizationHandler(context),
    update: createUpdateOrganizationHandler(context),
    remove: createRemoveOrganizationHandler(context),
  };
}
