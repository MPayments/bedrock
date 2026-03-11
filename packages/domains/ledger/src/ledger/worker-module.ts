import {
  defineModule,
  defineProvider,
  defineWorker,
  defineWorkerTrigger,
  token,
} from "@bedrock/core";
import { intervalSource } from "@bedrock/worker-interval";
import { z } from "zod";

import {
  DbToken,
  TbClientToken,
  WorkerObserversToken,
} from "@multihansa/common/bedrock";
import { type Worker } from "@multihansa/common/workers";
import {
  createLedgerWorkerDefinition as createLedgerWorker,
  LEDGER_WORKER_DESCRIPTOR,
} from "../ledger/worker";
import type { TbClient } from "../ledger/tb";

const LedgerWorkerImplementationToken = token<Worker>(
  "multihansa.ledger.worker-implementation",
);

export function createLedgerWorkerModule(input: { intervalMs: number }) {
  const worker = defineWorker("ledger", {
    deps: {
      implementation: LedgerWorkerImplementationToken,
      observers: WorkerObserversToken,
    },
    ctx: ({ implementation, observers }) => ({
      implementation,
      observers,
    }),
    payload: z.undefined(),
    handler: async ({ ctx, delivery }) => {
      const observer = ctx.observers[LEDGER_WORKER_DESCRIPTOR.id];
      const startedAt = Date.now();
      observer?.onTickStarted?.();

      try {
        const result = await ctx.implementation.runOnce({
          now: delivery.startedAt,
          signal: new AbortController().signal,
        });
        observer?.onTickSucceeded?.({
          durationMs: Date.now() - startedAt,
          processed: result.processed,
          result,
        });
      } catch (error) {
        observer?.onTickFailed?.({
          durationMs: Date.now() - startedAt,
          error,
        });
        throw error;
      }
    },
  });

  return defineModule("ledger", {
    providers: [
      defineProvider({
        provide: LedgerWorkerImplementationToken,
        scope: "singleton",
        deps: {
          db: DbToken,
          tb: TbClientToken,
        },
        useFactory: ({ db, tb }) =>
          createLedgerWorker({
            id: LEDGER_WORKER_DESCRIPTOR.id,
            intervalMs: input.intervalMs,
            db,
            tb: tb as TbClient,
          }),
      }),
    ],
    workers: [worker],
    workerTriggers: [
      defineWorkerTrigger("ledger-schedule", {
        source: intervalSource({
          everyMs: input.intervalMs,
        }),
        worker,
        tags: ["ledger"],
      }),
    ],
  });
}
