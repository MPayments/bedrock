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
  createIfrsPeriodCloseWorker,
  DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR,
} from "@multihansa/reporting/ifrs-documents";
import { type Worker } from "@multihansa/common/workers";
import { z } from "zod";

const IfrsDocumentsWorkerImplementationToken = token<Worker>(
  "multihansa.reporting.ifrs-documents-worker-implementation",
);

export function createIfrsDocumentsWorkerModule(input: { intervalMs: number }) {
  const worker = defineWorker("documents-period-close", {
    deps: {
      implementation: IfrsDocumentsWorkerImplementationToken,
      observers: WorkerObserversToken,
    },
    ctx: ({ implementation, observers }) => ({
      implementation,
      observers,
    }),
    payload: z.undefined(),
    handler: async ({ ctx, delivery }) => {
      const observer = ctx.observers[DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR.id];
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

  return defineModule("ifrs-documents", {
    providers: [
      defineProvider({
        provide: IfrsDocumentsWorkerImplementationToken,
        scope: "singleton",
        deps: {
          db: DbToken,
          logger: LoggerToken,
        },
        useFactory: ({ db, logger }) =>
          createIfrsPeriodCloseWorker({
            id: DOCUMENTS_PERIOD_CLOSE_WORKER_DESCRIPTOR.id,
            intervalMs: input.intervalMs,
            db,
            logger: adaptBedrockLogger(logger),
          }),
      }),
    ],
    workers: [worker],
    workerTriggers: [
      defineWorkerTrigger("ifrs-documents-schedule", {
        source: intervalSource({
          everyMs: input.intervalMs,
        }),
        worker,
        tags: ["ifrs-documents"],
      }),
    ],
  });
}
