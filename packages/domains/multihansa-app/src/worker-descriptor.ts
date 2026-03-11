import { createIntervalWorkerAdapter } from "@bedrock/worker-interval";
import {
  BALANCES_WORKER_DESCRIPTOR,
} from "@multihansa/balances";
import { createBalancesWorkerModule } from "@multihansa/balances";
import {
  DOCUMENTS_WORKER_DESCRIPTOR,
} from "@multihansa/documents/runtime";
import { createDocumentsWorkerModule } from "@multihansa/documents";
import {
  LEDGER_WORKER_DESCRIPTOR,
} from "@multihansa/ledger";
import { createLedgerWorkerModule } from "@multihansa/ledger";
import {
  RECONCILIATION_WORKER_DESCRIPTOR,
} from "@multihansa/reconciliation";
import { createReconciliationWorkerModule } from "@multihansa/reconciliation";
import {
  DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR,
} from "@multihansa/reporting/ifrs-documents";
import { createIfrsDocumentsWorkerModule } from "@multihansa/reporting";
import {
  FX_RATES_WORKER_DESCRIPTOR,
} from "@multihansa/treasury/fx";
import { createFxRatesWorkerModule } from "@multihansa/treasury";

import type { AppDescriptor, WorkerAdapter } from "@bedrock/core";
import type { WorkerDescriptor } from "@multihansa/common/workers";
import type { WorkerRunObserver } from "@multihansa/common/bedrock";

import { MultihansaWorkerConfig } from "./config";
import { createWorkerProviders } from "./providers";

export type CreateMultihansaWorkerDescriptorInput = {
  appName?: string;
  db: unknown;
  tb: unknown;
  workerIntervals: Record<string, number>;
  workerObservers?: Record<string, WorkerRunObserver | undefined>;
  logLevel?: "debug" | "info" | "warn" | "error";
  selectedWorkerIds?: readonly string[];
  workerAdapter?: WorkerAdapter;
};

const workerModuleDefinitions = [
  {
    descriptor: LEDGER_WORKER_DESCRIPTOR,
    createModule: createLedgerWorkerModule,
  },
  {
    descriptor: DOCUMENTS_WORKER_DESCRIPTOR,
    createModule: createDocumentsWorkerModule,
  },
  {
    descriptor: DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR,
    createModule: createIfrsDocumentsWorkerModule,
  },
  {
    descriptor: BALANCES_WORKER_DESCRIPTOR,
    createModule: createBalancesWorkerModule,
  },
  {
    descriptor: FX_RATES_WORKER_DESCRIPTOR,
    createModule: createFxRatesWorkerModule,
  },
  {
    descriptor: RECONCILIATION_WORKER_DESCRIPTOR,
    createModule: createReconciliationWorkerModule,
  },
] as const satisfies readonly {
  descriptor: WorkerDescriptor;
  createModule: (input: { intervalMs: number }) => AppDescriptor["modules"][number];
}[];

function createObservedWorkerAdapter(input: {
  adapter: WorkerAdapter;
  workerIds: readonly string[];
  workerObservers?: Record<string, WorkerRunObserver | undefined>;
}): WorkerAdapter {
  return {
    ...input.adapter,
    async start() {
      for (const workerId of input.workerIds) {
        input.workerObservers?.[workerId]?.onLoopStarted?.();
      }
      await input.adapter.start();
    },
    async stop(options) {
      await input.adapter.stop(options);
      for (const workerId of input.workerIds) {
        input.workerObservers?.[workerId]?.onLoopStopped?.();
      }
    },
  };
}

export function createMultihansaWorkerDescriptor(
  input: CreateMultihansaWorkerDescriptorInput,
): AppDescriptor {
  const selectedIds =
    input.selectedWorkerIds && input.selectedWorkerIds.length > 0
      ? new Set(input.selectedWorkerIds)
      : null;

  const modules = workerModuleDefinitions
    .map((definition) => {
      if (selectedIds && !selectedIds.has(definition.descriptor.id)) {
        return null;
      }

      return definition.createModule({
        intervalMs:
          input.workerIntervals[definition.descriptor.id] ??
          definition.descriptor.defaultIntervalMs,
      });
    })
    .filter((module): module is NonNullable<typeof module> => module !== null);

  const activeWorkerIds = workerModuleDefinitions
    .map((definition) => definition.descriptor.id)
    .filter((workerId) => selectedIds === null || selectedIds.has(workerId));

  const workerAdapter = createObservedWorkerAdapter({
    adapter: input.workerAdapter ?? createIntervalWorkerAdapter(),
    workerIds: activeWorkerIds,
    workerObservers: input.workerObservers,
  });

  return {
    modules,
    providers: [
      MultihansaWorkerConfig.provider(),
      ...createWorkerProviders({
        appName: input.appName,
        db: input.db,
        tb: input.tb,
        workerIntervals: input.workerIntervals,
        workerObservers: input.workerObservers,
        logLevel: input.logLevel,
      }),
    ],
    workerAdapters: [workerAdapter],
    logger: {
      source: {
        type: "provider",
      },
    },
  };
}
