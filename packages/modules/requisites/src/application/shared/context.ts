import type { Logger } from "@bedrock/platform/observability/logger";
import { noopLogger } from "@bedrock/platform/observability/logger";
import type { Queryable, Transaction } from "@bedrock/platform/persistence";

import type {
  RequisiteAccountingBindingsCommandRepository,
  RequisiteAccountingBindingsQueryRepository,
} from "../bindings/ports";
import type {
  RequisitesCommandRepository,
  RequisitesQueryRepository,
} from "../requisites/ports";
import type {
  RequisiteProvidersCommandRepository,
  RequisiteProvidersQueryRepository,
} from "../providers/ports";
import type {
  RequisitesCurrenciesPort,
  RequisitesOwnersPort,
} from "./external-ports";

export interface RequisitesServiceDeps {
  db: Queryable;
  logger?: Logger;
  now?: () => Date;
  runInTransaction?: <T>(run: (tx: Transaction) => Promise<T>) => Promise<T>;
  currencies: RequisitesCurrenciesPort;
  owners: RequisitesOwnersPort;
}

export interface RequisitesServiceContext {
  log: Logger;
  now: () => Date;
  runInTransaction: <T>(run: (tx: Transaction) => Promise<T>) => Promise<T>;
  currencies: RequisitesCurrenciesPort;
  owners: RequisitesOwnersPort;
  requisiteQueries: RequisitesQueryRepository;
  requisiteCommands: RequisitesCommandRepository;
  bindingQueries: RequisiteAccountingBindingsQueryRepository;
  bindingCommands: RequisiteAccountingBindingsCommandRepository;
  providerQueries: RequisiteProvidersQueryRepository;
  providerCommands: RequisiteProvidersCommandRepository;
}

export function createRequisitesServiceContext(input: {
  logger?: Logger;
  now?: () => Date;
  runInTransaction: <T>(run: (tx: Transaction) => Promise<T>) => Promise<T>;
  currencies: RequisitesCurrenciesPort;
  owners: RequisitesOwnersPort;
  requisiteQueries: RequisitesQueryRepository;
  requisiteCommands: RequisitesCommandRepository;
  bindingQueries: RequisiteAccountingBindingsQueryRepository;
  bindingCommands: RequisiteAccountingBindingsCommandRepository;
  providerQueries: RequisiteProvidersQueryRepository;
  providerCommands: RequisiteProvidersCommandRepository;
}): RequisitesServiceContext {
  return {
    log: input.logger?.child({ service: "requisites" }) ?? noopLogger,
    now: input.now ?? (() => new Date()),
    runInTransaction: input.runInTransaction,
    currencies: input.currencies,
    owners: input.owners,
    requisiteQueries: input.requisiteQueries,
    requisiteCommands: input.requisiteCommands,
    bindingQueries: input.bindingQueries,
    bindingCommands: input.bindingCommands,
    providerQueries: input.providerQueries,
    providerCommands: input.providerCommands,
  };
}
