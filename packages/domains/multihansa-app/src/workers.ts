
import { createBalancesProjectorWorkerDefinition } from "@bedrock/balances";
import type { Logger } from "@bedrock/common";
import { createDocumentsWorkerDefinition } from "@bedrock/documents/runtime";
import {
  createLedgerWorkerDefinition,
  type TbClient,
} from "@bedrock/ledger";
import {
  listWorkerCatalogEntries,
  type BedrockWorker,
  type ModuleRuntimeService,
  type WorkerCatalogEntry,
} from "@bedrock/modules";
import type { Database } from "@bedrock/sql/ports";

import {
  createFxRatesWorkerDefinition,
  type FxService,
} from "@multihansa/fx";
import { createIfrsPeriodCloseWorkerDefinition } from "@multihansa/ifrs-documents";

import { MULTIHANSA_MODULE_MANIFESTS } from "./module-runtime";

const workerCatalogById = new Map<string, WorkerCatalogEntry>(
  listWorkerCatalogEntries(MULTIHANSA_MODULE_MANIFESTS).map((entry) => [
    entry.id,
    entry,
  ]),
);

function requireWorkerCatalogEntry(workerId: string): WorkerCatalogEntry {
  const entry = workerCatalogById.get(workerId);
  if (!entry) {
    throw new Error(`Missing worker catalog entry for ${workerId}`);
  }
  return entry;
}

function resolveIntervalMs(
  workerId: string,
  workerIntervals: Record<string, number | undefined>,
) {
  const entry = requireWorkerCatalogEntry(workerId);
  const intervalMs = workerIntervals[workerId] ?? entry.defaultIntervalMs;

  if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
    throw new Error(`Invalid interval for worker ${workerId}: ${intervalMs}`);
  }

  return intervalMs;
}

function dedupeBookIds(bookIds: readonly string[]) {
  const unique = new Set<string>();
  for (const bookId of bookIds) {
    const normalized = bookId.trim();
    if (normalized.length > 0) {
      unique.add(normalized);
    }
  }
  return [...unique];
}

async function isModuleEnabledForBooks(input: {
  moduleRuntime: ModuleRuntimeService;
  moduleId: string;
  bookIds?: readonly string[];
}) {
  const bookIds = dedupeBookIds(input.bookIds ?? []);

  if (bookIds.length === 0) {
    return input.moduleRuntime.isModuleEnabled({
      moduleId: input.moduleId,
    });
  }

  for (const bookId of bookIds) {
    const enabled = await input.moduleRuntime.isModuleEnabled({
      moduleId: input.moduleId,
      bookId,
    });
    if (!enabled) {
      return false;
    }
  }

  return true;
}

export function createMultihansaWorkerImplementations(input: {
  db: Database;
  logger: Logger;
  moduleRuntime: ModuleRuntimeService;
  tb: TbClient;
  workerIntervals: Record<string, number | undefined>;
  services: {
    fxService: FxService;
  };
}): Record<string, BedrockWorker> {
  const { db, logger, moduleRuntime, tb, workerIntervals, services } = input;

  const ledger = createLedgerWorkerDefinition({
    id: "ledger",
    moduleId: "ledger",
    intervalMs: resolveIntervalMs("ledger", workerIntervals),
    db,
    tb,
    beforeJob: ({ bookIds }) =>
      isModuleEnabledForBooks({
        moduleRuntime,
        moduleId: "ledger",
        bookIds,
      }),
  });

  const documents = createDocumentsWorkerDefinition({
    id: "documents",
    moduleId: "documents",
    intervalMs: resolveIntervalMs("documents", workerIntervals),
    db,
    beforeDocument: ({ bookIds }) =>
      isModuleEnabledForBooks({
        moduleRuntime,
        moduleId: "documents",
        bookIds,
      }),
  });

  const documentsPeriodClose = createIfrsPeriodCloseWorkerDefinition({
    id: "documents-period-close",
    moduleId: "ifrs-documents",
    intervalMs: resolveIntervalMs("documents-period-close", workerIntervals),
    db,
    logger,
    beforeCounterparty: () =>
      moduleRuntime.isModuleEnabled({
        moduleId: "ifrs-documents",
      }),
  });

  const balances = createBalancesProjectorWorkerDefinition({
    id: "balances",
    moduleId: "balances",
    intervalMs: resolveIntervalMs("balances", workerIntervals),
    db,
    logger,
    beforeOperation: ({ bookIds }) =>
      isModuleEnabledForBooks({
        moduleRuntime,
        moduleId: "balances",
        bookIds,
      }),
  });

  const fxRates = createFxRatesWorkerDefinition({
    id: "fx-rates",
    moduleId: "fx-rates",
    intervalMs: resolveIntervalMs("fx-rates", workerIntervals),
    fxService: services.fxService,
    logger,
    beforeSourceSync: () =>
      moduleRuntime.isModuleEnabled({
        moduleId: "fx-rates",
      }),
  });

  return {
    [ledger.id]: ledger,
    [documents.id]: documents,
    [documentsPeriodClose.id]: documentsPeriodClose,
    [balances.id]: balances,
    [fxRates.id]: fxRates,
  };
}
