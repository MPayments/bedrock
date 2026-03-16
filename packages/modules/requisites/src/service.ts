import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import type { RunInPersistenceSession } from "@bedrock/shared/core/persistence";

import {
  createGetRequisiteAccountingBindingHandler,
  createResolveRequisiteAccountingBindingsHandler,
} from "./application/bindings/queries";
import { createUpsertRequisiteAccountingBindingHandler } from "./application/bindings/commands";
import {
  createCreateRequisiteHandler,
  createRemoveRequisiteHandler,
  createUpdateRequisiteHandler,
} from "./application/requisites/commands";
import {
  createCreateRequisiteProviderHandler,
  createRemoveRequisiteProviderHandler,
  createUpdateRequisiteProviderHandler,
} from "./application/providers/commands";
import {
  createFindRequisiteByIdHandler,
  createListRequisiteOptionsHandler,
  createListRequisitesHandler,
} from "./application/requisites/queries";
import {
  createAssertActiveRequisiteProviderHandler,
  createFindRequisiteProviderByIdHandler,
  createListRequisiteProvidersHandler,
} from "./application/providers/queries";
import {
  createRequisitesServiceContext,
} from "./application/shared/context";
import type {
  RequisitesCurrenciesPort,
  RequisitesOwnersPort,
} from "./application/shared/external-ports";
import {
  createDrizzleRequisiteAccountingBindingsCommandRepository,
  createDrizzleRequisiteAccountingBindingsQueryRepository,
} from "./infra/drizzle/repos/requisite-bindings-repository";
import {
  createDrizzleRequisitesCommandRepository,
  createDrizzleRequisitesQueryRepository,
} from "./infra/drizzle/repos/requisites-repository";
import {
  createDrizzleRequisiteProvidersCommandRepository,
  createDrizzleRequisiteProvidersQueryRepository,
} from "./infra/drizzle/repos/requisite-providers-repository";

export type RequisitesService = ReturnType<typeof createRequisitesService>;
export interface RequisitesServiceDeps {
  db: Database;
  logger?: Logger;
  now?: () => Date;
  runInTransaction?: RunInPersistenceSession;
  currencies: RequisitesCurrenciesPort;
  owners: RequisitesOwnersPort;
}
export interface RequisitesServiceTransactionDeps extends Omit<
  RequisitesServiceDeps,
  "db" | "runInTransaction"
> {
  tx: Transaction;
}

export function createRequisitesServiceFromContext(
  context: ReturnType<typeof createRequisitesServiceContext>,
) {
  return {
    list: createListRequisitesHandler(context),
    listOptions: createListRequisiteOptionsHandler(context),
    findById: createFindRequisiteByIdHandler(context),
    create: createCreateRequisiteHandler(context),
    update: createUpdateRequisiteHandler(context),
    remove: createRemoveRequisiteHandler(context),
    bindings: {
      get: createGetRequisiteAccountingBindingHandler(context),
      resolve: createResolveRequisiteAccountingBindingsHandler(context),
      upsert: createUpsertRequisiteAccountingBindingHandler(context),
    },
    providers: {
      list: createListRequisiteProvidersHandler(context),
      findById: createFindRequisiteProviderByIdHandler(context),
      assertActive: createAssertActiveRequisiteProviderHandler(context),
      create: createCreateRequisiteProviderHandler(context),
      update: createUpdateRequisiteProviderHandler(context),
      remove: createRemoveRequisiteProviderHandler(context),
    },
  };
}

export function createRequisitesService(deps: RequisitesServiceDeps) {
  const context = createRequisitesServiceContext({
    logger: deps.logger,
    now: deps.now,
    runInTransaction:
      deps.runInTransaction ??
      ((run) =>
        (deps.db as Database).transaction((tx: Transaction) => run(tx))),
    currencies: deps.currencies,
    owners: deps.owners,
    requisiteQueries: createDrizzleRequisitesQueryRepository(deps.db),
    requisiteCommands: createDrizzleRequisitesCommandRepository(deps.db),
    bindingQueries: createDrizzleRequisiteAccountingBindingsQueryRepository(
      deps.db,
    ),
    bindingCommands: createDrizzleRequisiteAccountingBindingsCommandRepository(
      deps.db,
    ),
    providerQueries: createDrizzleRequisiteProvidersQueryRepository(deps.db),
    providerCommands: createDrizzleRequisiteProvidersCommandRepository(deps.db),
  });

  return createRequisitesServiceFromContext(context);
}

export function createRequisitesServiceFromTransaction(
  deps: RequisitesServiceTransactionDeps,
) {
  return createRequisitesService({
    ...deps,
    db: deps.tx,
    runInTransaction: (run) => run(deps.tx),
  });
}
