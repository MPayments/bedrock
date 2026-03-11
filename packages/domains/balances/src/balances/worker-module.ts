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
  BALANCES_WORKER_DESCRIPTOR,
  createBalancesProjectorWorkerDefinition as createBalancesProjectorWorker,
} from "../balances/worker";
import { type Worker } from "@multihansa/common/workers";
import { z } from "zod";

const BalancesWorkerImplementationToken = token<Worker>(
  "multihansa.balances.worker-implementation",
);

export function createBalancesWorkerModule(input: { intervalMs: number }) {
  const worker = defineWorker("balances", {
    deps: {
      implementation: BalancesWorkerImplementationToken,
      observers: WorkerObserversToken,
    },
    ctx: ({ implementation, observers }) => ({
      implementation,
      observers,
    }),
    payload: z.undefined(),
    handler: async ({ ctx, delivery }) => {
      const observer = ctx.observers[BALANCES_WORKER_DESCRIPTOR.id];
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

  return defineModule("balances", {
    providers: [
      defineProvider({
        provide: BalancesWorkerImplementationToken,
        scope: "singleton",
        deps: {
          db: DbToken,
          logger: LoggerToken,
        },
        useFactory: ({ db, logger }) =>
          createBalancesProjectorWorker({
            id: BALANCES_WORKER_DESCRIPTOR.id,
            intervalMs: input.intervalMs,
            db,
            logger: adaptBedrockLogger(logger),
          }),
      }),
    ],
    workers: [worker],
    workerTriggers: [
      defineWorkerTrigger("balances-schedule", {
        source: intervalSource({
          everyMs: input.intervalMs,
        }),
        worker,
        tags: ["balances"],
      }),
    ],
  });
}
