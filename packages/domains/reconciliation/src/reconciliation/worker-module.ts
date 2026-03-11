import {
  defineModule,
  defineProvider,
  defineWorker,
  defineWorkerTrigger,
  LoggerToken,
  token,
} from "@bedrock/core";
import { intervalSource } from "@bedrock/worker-interval";
import {
  adaptBedrockLogger,
  DbToken,
  WorkerObserversToken,
} from "@multihansa/common/bedrock";
import {
  createReconciliationWorkerDefinition as createReconciliationWorker,
  RECONCILIATION_WORKER_DESCRIPTOR,
} from "../reconciliation/worker";
import { type Worker } from "@multihansa/common/workers";
import { z } from "zod";

const ReconciliationWorkerImplementationToken = token<Worker>(
  "multihansa.reconciliation.worker-implementation",
);

export function createReconciliationWorkerModule(input: { intervalMs: number }) {
  const worker = defineWorker("reconciliation", {
    deps: {
      implementation: ReconciliationWorkerImplementationToken,
      observers: WorkerObserversToken,
    },
    ctx: ({ implementation, observers }) => ({
      implementation,
      observers,
    }),
    payload: z.undefined(),
    handler: async ({ ctx, delivery }) => {
      const observer = ctx.observers[RECONCILIATION_WORKER_DESCRIPTOR.id];
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

  return defineModule("reconciliation", {
    providers: [
      defineProvider({
        provide: ReconciliationWorkerImplementationToken,
        scope: "singleton",
        deps: {
          db: DbToken,
          logger: LoggerToken,
        },
        useFactory: ({ db, logger }) =>
          createReconciliationWorker({
            id: RECONCILIATION_WORKER_DESCRIPTOR.id,
            intervalMs: input.intervalMs,
            db,
            logger: adaptBedrockLogger(logger),
          }),
      }),
    ],
    workers: [worker],
    workerTriggers: [
      defineWorkerTrigger("reconciliation-schedule", {
        source: intervalSource({
          everyMs: input.intervalMs,
        }),
        worker,
        tags: ["reconciliation"],
      }),
    ],
  });
}
