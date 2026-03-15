import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import type { BalancesStateRepository } from "../balances/ports";
import type { BalancesProjectionRepository } from "../projection/ports";
import type { BalancesReportingRepository } from "../reporting/ports";

export interface BalancesServiceDeps {
  db: Database;
  idempotency: IdempotencyPort;
  logger?: Logger;
}

export interface BalancesContext {
  db: Database;
  idempotency: IdempotencyPort;
  log: Logger;
  createStateRepository: (
    db: Database | Transaction,
  ) => BalancesStateRepository;
}

export interface BalancesQueriesContext {
  createReportingRepository: (
    db: Database,
  ) => BalancesReportingRepository;
}

export interface BalancesWorkerContext {
  db: Database;
  log: Logger;
  createProjectionRepository: (
    tx: Transaction,
  ) => BalancesProjectionRepository;
}

export function createBalancesContext(input: {
  db: Database;
  idempotency: IdempotencyPort;
  logger?: Logger;
  createStateRepository: (
    db: Database | Transaction,
  ) => BalancesStateRepository;
}): BalancesContext {
  return {
    db: input.db,
    idempotency: input.idempotency,
    log: input.logger?.child({ svc: "balances" }) ?? noopLogger,
    createStateRepository: input.createStateRepository,
  };
}

export function createBalancesQueriesContext(input: {
  createReportingRepository: (db: Database) => BalancesReportingRepository;
}): BalancesQueriesContext {
  return input;
}

export function createBalancesWorkerContext(input: {
  db: Database;
  logger?: Logger;
  createProjectionRepository: (
    tx: Transaction,
  ) => BalancesProjectionRepository;
}): BalancesWorkerContext {
  return {
    db: input.db,
    log: input.logger?.child({ svc: "balances-projector" }) ?? noopLogger,
    createProjectionRepository: input.createProjectionRepository,
  };
}
