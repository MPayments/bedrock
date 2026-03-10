import type { Logger } from "@bedrock/common";
import type { Database } from "@bedrock/common/sql/ports";
import { type BedrockWorker, type BedrockWorkerDescriptor } from "@bedrock/common/workers";
import {
  DOCUMENTS_WORKER_DESCRIPTOR,
  createDocumentsWorker,
} from "@bedrock/documents/runtime";
import {
  BALANCES_WORKER_DESCRIPTOR,
  createBalancesProjectorWorker,
} from "@bedrock/finance/balances";
import {
  LEDGER_WORKER_DESCRIPTOR,
  createLedgerWorker,
  type TbClient,
} from "@bedrock/finance/ledger";

import {
  DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR,
  createIfrsPeriodCloseWorker,
} from "@multihansa/reporting/ifrs-documents";
import {
  FX_RATES_WORKER_DESCRIPTOR,
  createFxRatesWorker,
  type FxService,
} from "@multihansa/treasury/fx";

export const MULTIHANSA_WORKER_DESCRIPTORS = [
  BALANCES_WORKER_DESCRIPTOR,
  DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR,
  DOCUMENTS_WORKER_DESCRIPTOR,
  FX_RATES_WORKER_DESCRIPTOR,
  LEDGER_WORKER_DESCRIPTOR,
] as const satisfies readonly BedrockWorkerDescriptor[];

const workerDescriptorById = new Map(
  MULTIHANSA_WORKER_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor]),
);

function requireWorkerInterval(
  workerId: string,
  workerIntervals: Record<string, number>,
) {
  const descriptor = workerDescriptorById.get(workerId);
  if (!descriptor) {
    throw new Error(`Missing worker descriptor for ${workerId}`);
  }

  const intervalMs = workerIntervals[workerId] ?? descriptor.defaultIntervalMs;
  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid interval for worker ${workerId}: ${intervalMs}`);
  }

  return intervalMs;
}

export function createMultihansaWorkers(input: {
  db: Database;
  logger: Logger;
  tb: TbClient;
  workerIntervals: Record<string, number>;
  services: {
    fxService: FxService;
  };
}): Record<string, BedrockWorker> {
  const { db, logger, tb, workerIntervals, services } = input;

  const ledger = createLedgerWorker({
    id: LEDGER_WORKER_DESCRIPTOR.id,
    intervalMs: requireWorkerInterval(
      LEDGER_WORKER_DESCRIPTOR.id,
      workerIntervals,
    ),
    db,
    tb,
  });

  const documents = createDocumentsWorker({
    id: DOCUMENTS_WORKER_DESCRIPTOR.id,
    intervalMs: requireWorkerInterval(
      DOCUMENTS_WORKER_DESCRIPTOR.id,
      workerIntervals,
    ),
    db,
  });

  const documentsPeriodClose = createIfrsPeriodCloseWorker({
    id: DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR.id,
    intervalMs: requireWorkerInterval(
      DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR.id,
      workerIntervals,
    ),
    db,
    logger,
  });

  const balances = createBalancesProjectorWorker({
    id: BALANCES_WORKER_DESCRIPTOR.id,
    intervalMs: requireWorkerInterval(
      BALANCES_WORKER_DESCRIPTOR.id,
      workerIntervals,
    ),
    db,
    logger,
  });

  const fxRates = createFxRatesWorker({
    id: FX_RATES_WORKER_DESCRIPTOR.id,
    intervalMs: requireWorkerInterval(
      FX_RATES_WORKER_DESCRIPTOR.id,
      workerIntervals,
    ),
    fxService: services.fxService,
    logger,
  });

  return {
    [ledger.id]: ledger,
    [documents.id]: documents,
    [documentsPeriodClose.id]: documentsPeriodClose,
    [balances.id]: balances,
    [fxRates.id]: fxRates,
  };
}
