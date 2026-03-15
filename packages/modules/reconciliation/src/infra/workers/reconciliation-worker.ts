import {
  noopLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";
import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

import type {
  ReconciliationDocumentsPort,
  ReconciliationIdempotencyPort,
  ReconciliationLedgerLookupPort,
} from "../../application/shared/external-ports";
import {
  createProcessPendingSourcesHandler,
  type ReconciliationWorkerSourceGuard,
} from "../../application/processing/commands";
import { createReconciliationServiceContext } from "../../application/shared/context";

export function createReconciliationWorkerDefinition(deps: {
  id?: string;
  intervalMs?: number;
  db: Database;
  documents: ReconciliationDocumentsPort;
  idempotency: ReconciliationIdempotencyPort;
  ledgerLookup: ReconciliationLedgerLookupPort;
  logger?: Logger;
  rulesetChecksum?: string;
  beforeSource?: ReconciliationWorkerSourceGuard;
  batchSize?: number;
}): BedrockWorker {
  const rulesetChecksum = deps.rulesetChecksum ?? "core-default-v1";
  const batchSize = deps.batchSize ?? 25;
  const log =
    deps.logger?.child({ svc: "reconciliation-worker" }) ?? noopLogger;
  const context = createReconciliationServiceContext({
    db: deps.db,
    documents: deps.documents,
    idempotency: deps.idempotency,
    ledgerLookup: deps.ledgerLookup,
    logger: deps.logger,
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
