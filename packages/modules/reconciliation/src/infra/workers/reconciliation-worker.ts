import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type Transaction,
} from "@bedrock/platform/persistence";
import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

import {
  createProcessPendingSourcesHandler,
  type ReconciliationWorkerSourceGuard,
} from "../../application/processing/commands";
import { createReconciliationServiceContext } from "../../application/shared/context";
import type {
  ReconciliationDocumentsPort,
  ReconciliationExecutionFactsTxPort,
  ReconciliationLedgerLookupPort,
} from "../../application/shared/external-ports";
import { createReconciliationTransactions } from "../../service";
import { createDrizzleReconciliationServiceAdapters } from "../drizzle/context";

export function createReconciliationWorkerDefinition(deps: {
  id?: string;
  intervalMs?: number;
  db: Database;
  documents: ReconciliationDocumentsPort;
  idempotency: IdempotencyPort;
  ledgerLookup: ReconciliationLedgerLookupPort;
  createExecutionFacts?(tx: Transaction): ReconciliationExecutionFactsTxPort;
  logger?: Logger;
  rulesetChecksum?: string;
  beforeSource?: ReconciliationWorkerSourceGuard;
  batchSize?: number;
}): BedrockWorker {
  const rulesetChecksum = deps.rulesetChecksum ?? "core-default-v1";
  const batchSize = deps.batchSize ?? 25;
  const log =
    deps.logger?.child({ svc: "reconciliation-worker" }) ?? noopLogger;
  const adapters = createDrizzleReconciliationServiceAdapters(deps.db);
  const context = createReconciliationServiceContext({
    documents: deps.documents,
    ledgerLookup: deps.ledgerLookup,
    logger: deps.logger,
    matches: adapters.matchesRepo,
    exceptions: adapters.exceptionsRepo,
    pendingSources: adapters.pendingSources,
    transactions: createReconciliationTransactions({
      persistence: createPersistenceContext(deps.db),
      idempotency: deps.idempotency,
      externalRecords: adapters.externalRecordsRepo,
      runs: adapters.runsRepo,
      matches: adapters.matchesRepo,
      exceptions: adapters.exceptionsRepo,
      createExecutionFacts: deps.createExecutionFacts,
    }),
  });
  const processPendingSources = createProcessPendingSourcesHandler(context);

  async function runOnce(_ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await processPendingSources({
      rulesetChecksum,
      batchSize,
      beforeSource: deps.beforeSource,
    });

    if (processed > 0) {
      log.info("Processed reconciliation runs", {
        processed,
        rulesetChecksum,
      });
    }

    return { processed };
  }

  return {
    id: deps.id ?? "reconciliation",
    intervalMs: deps.intervalMs ?? 60_000,
    runOnce,
  };
}
