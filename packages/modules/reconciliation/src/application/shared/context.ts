import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";

import type {
  ReconciliationDocumentsPort,
  ReconciliationLedgerLookupPort,
  ReconciliationTransactionsPort,
} from "./external-ports";
import type {
  ReconciliationExceptionsQueryRepository,
  ReconciliationPendingSourcesPort,
} from "../exceptions/ports";
import type { ReconciliationMatchesQueryRepository } from "../runs/ports";

export interface ReconciliationServiceContext {
  documents: ReconciliationDocumentsPort;
  ledgerLookup: ReconciliationLedgerLookupPort;
  matches: ReconciliationMatchesQueryRepository;
  exceptions: ReconciliationExceptionsQueryRepository;
  pendingSources: ReconciliationPendingSourcesPort;
  transactions: ReconciliationTransactionsPort;
  log: Logger;
}

export function createReconciliationServiceContext(input: {
  documents: ReconciliationDocumentsPort;
  ledgerLookup: ReconciliationLedgerLookupPort;
  matches: ReconciliationMatchesQueryRepository;
  exceptions: ReconciliationExceptionsQueryRepository;
  pendingSources: ReconciliationPendingSourcesPort;
  transactions: ReconciliationTransactionsPort;
  logger?: Logger;
}): ReconciliationServiceContext {
  return {
    documents: input.documents,
    ledgerLookup: input.ledgerLookup,
    matches: input.matches,
    exceptions: input.exceptions,
    pendingSources: input.pendingSources,
    transactions: input.transactions,
    log: input.logger?.child({ svc: "reconciliation" }) ?? noopLogger,
  };
}
