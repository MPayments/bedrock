import {
  defineModule,
  defineWorker,
  defineWorkerTrigger,
} from "@bedrock/core";
import { intervalSource } from "@bedrock/worker-interval";
import { assetsModule } from "@multihansa/assets";
import { WorkerObserversToken } from "@multihansa/common/bedrock";
import {
  createFxRatesWorker,
  FX_RATES_WORKER_DESCRIPTOR,
} from "@multihansa/treasury/fx";
import { z } from "zod";

import { FxDomainServiceToken } from "./tokens";
import { treasuryFxModule } from "./module";

export function createFxRatesWorkerModule(input: { intervalMs: number }) {
  const worker = defineWorker("fx-rates", {
    deps: {
      fxService: FxDomainServiceToken,
      observers: WorkerObserversToken,
    },
    ctx: ({ fxService, observers }) => ({
      fxService,
      observers,
    }),
    payload: z.undefined(),
    handler: async ({ ctx, delivery }) => {
      const observer = ctx.observers[FX_RATES_WORKER_DESCRIPTOR.id];
      const startedAt = Date.now();
      observer?.onTickStarted?.();

      try {
        const result = await createFxRatesWorker({
          id: FX_RATES_WORKER_DESCRIPTOR.id,
          intervalMs: input.intervalMs,
          fxService: ctx.fxService,
        }).runOnce({
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

  return defineModule("fx-rates", {
    imports: [assetsModule, treasuryFxModule],
    workers: [worker],
    workerTriggers: [
      defineWorkerTrigger("fx-rates-schedule", {
        source: intervalSource({
          everyMs: input.intervalMs,
        }),
        worker,
        tags: ["fx-rates"],
      }),
    ],
  });
}
