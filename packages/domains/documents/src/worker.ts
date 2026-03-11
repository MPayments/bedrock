import {
  defineModule,
  defineProvider,
  defineWorker,
  defineWorkerTrigger,
  token,
} from "@bedrock/core";
import { intervalSource } from "@bedrock/worker-interval";
import {
  DbToken,
  WorkerObserversToken,
} from "@multihansa/common/bedrock";
import {
  createDocumentsWorker,
  DOCUMENTS_WORKER_DESCRIPTOR,
} from "@multihansa/documents/runtime";
import { type Worker } from "@multihansa/common/workers";
import { z } from "zod";

const DocumentsWorkerImplementationToken = token<Worker>(
  "multihansa.documents.worker-implementation",
);

export function createDocumentsWorkerModule(input: { intervalMs: number }) {
  const worker = defineWorker("documents", {
    deps: {
      implementation: DocumentsWorkerImplementationToken,
      observers: WorkerObserversToken,
    },
    ctx: ({ implementation, observers }) => ({
      implementation,
      observers,
    }),
    payload: z.undefined(),
    handler: async ({ ctx, delivery }) => {
      const observer = ctx.observers[DOCUMENTS_WORKER_DESCRIPTOR.id];
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

  return defineModule("documents", {
    providers: [
      defineProvider({
        provide: DocumentsWorkerImplementationToken,
        scope: "singleton",
        deps: {
          db: DbToken,
        },
        useFactory: ({ db }) =>
          createDocumentsWorker({
            id: DOCUMENTS_WORKER_DESCRIPTOR.id,
            intervalMs: input.intervalMs,
            db,
          }),
      }),
    ],
    workers: [worker],
    workerTriggers: [
      defineWorkerTrigger("documents-schedule", {
        source: intervalSource({
          everyMs: input.intervalMs,
        }),
        worker,
        tags: ["documents"],
      }),
    ],
  });
}
