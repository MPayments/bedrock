import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import type {
  BalancesProjectionPort,
  BalancesReportingPort,
  BalancesStatePort,
} from "../ports";

export interface BalancesServiceDeps {
  db: Database;
  idempotency: IdempotencyPort;
  logger?: Logger;
}

export interface BalancesContext {
  db: Database;
  idempotency: IdempotencyPort;
  log: Logger;
  createStateRepository: (db: Database | Transaction) => BalancesStatePort;
}

export interface BalancesQueriesContext {
  createReportingRepository: (
    db: Database | Transaction,
  ) => BalancesReportingPort;
}

export interface BalancesWorkerContext {
  db: Database;
  log: Logger;
  createProjectionRepository: (
    tx: Transaction,
  ) => BalancesProjectionPort;
}

export function createBalancesContext(input: {
  db: Database;
  idempotency: IdempotencyPort;
  logger?: Logger;
  createStateRepository: (db: Database | Transaction) => BalancesStatePort;
}): BalancesContext {
  return {
    db: input.db,
    idempotency: input.idempotency,
    log: input.logger?.child({ svc: "balances" }) ?? noopLogger,
    createStateRepository: input.createStateRepository,
  };
}

export function createBalancesQueriesContext(input: {
  createReportingRepository: (
    db: Database | Transaction,
  ) => BalancesReportingPort;
}): BalancesQueriesContext {
  return input;
}

export function createBalancesWorkerContext(input: {
  db: Database;
  logger?: Logger;
  createProjectionRepository: (tx: Transaction) => BalancesProjectionPort;
}): BalancesWorkerContext {
  return {
    db: input.db,
    log: input.logger?.child({ svc: "balances-projector" }) ?? noopLogger,
    createProjectionRepository: input.createProjectionRepository,
  };
}
