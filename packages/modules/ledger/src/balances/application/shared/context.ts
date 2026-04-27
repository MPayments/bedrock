import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";

import type { BalancesProjectionTransactionsPort } from "./external-ports";

export interface BalancesWorkerContext {
  log: Logger;
  transactions: BalancesProjectionTransactionsPort;
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
