import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  PersistenceContext,
  Queryable,
} from "@bedrock/platform/persistence";
import { createTransactionalPort as createTransactionalRepository } from "@bedrock/platform/persistence";

import {
  createCreateOrganizationHandler,
  createRemoveOrganizationHandler,
  createUpdateOrganizationHandler,
} from "./application/organizations/commands";
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
  persistence: PersistenceContext;
  logger?: Logger;
  now?: () => Date;
}

function createOrganizationsTransactions(input: {
  persistence: PersistenceContext;
}): OrganizationsTransactionsPort {
  const organizations = createTransactionalRepository(
    input.persistence,
    createDrizzleOrganizationsCommandRepository,
  );

  return {
    async withTransaction(run) {
      return organizations.withTransaction((transactionalOrganizations) =>
        run({
          organizations: transactionalOrganizations,
        }));
    },
  };
}

export function createOrganizationsService(deps: OrganizationsServiceDeps) {
  return createOrganizationsServiceContextHandlers({
    logger: deps.logger,
    now: deps.now,
    db: deps.persistence.db,
    transactions: createOrganizationsTransactions({
      persistence: deps.persistence,
    }),
  });
}

function createOrganizationsServiceContextHandlers(input: {
  db: Queryable;
  logger?: Logger;
  now?: () => Date;
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
