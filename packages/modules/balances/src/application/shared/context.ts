import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";

import type {
  BalancesProjectionTransactionsPort,
  BalancesTransactionsPort,
} from "./external-ports";
import type { BalancesStateRepository } from "../balances/ports";
import type { BalancesReportingRepository } from "../reporting/ports";

export interface BalancesContext {
  log: Logger;
  stateRepository: BalancesStateRepository;
  transactions: BalancesTransactionsPort;
}

export interface BalancesQueriesContext {
  reporting: BalancesReportingRepository;
}

export interface BalancesWorkerContext {
  log: Logger;
  transactions: BalancesProjectionTransactionsPort;
}

export function createBalancesContext(input: {
  logger?: Logger;
  stateRepository: BalancesStateRepository;
  transactions: BalancesTransactionsPort;
}): BalancesContext {
  return {
    log: input.logger?.child({ svc: "balances" }) ?? noopLogger,
    stateRepository: input.stateRepository,
    transactions: input.transactions,
  };
}

export function createBalancesQueriesContext(input: {
  reporting: BalancesReportingRepository;
}): BalancesQueriesContext {
  return input;
}

export function createBalancesWorkerContext(input: {
  logger?: Logger;
  transactions: BalancesProjectionTransactionsPort;
}): BalancesWorkerContext {
  return {
    log: input.logger?.child({ svc: "balances-projector" }) ?? noopLogger,
    transactions: input.transactions,
  };
}
