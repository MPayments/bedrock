import { type Logger } from "@bedrock/common";
import {
  defineWorkerDescriptor,
  type BedrockWorker,
  type BedrockWorkerRunContext as WorkerRunContext,
  type BedrockWorkerRunResult as WorkerRunResult,
} from "@bedrock/workers";

import { type FxService } from "./service";
import { type FxRateSource } from "./sources";

export interface FxRatesWorkerSourceContext {
    source: FxRateSource;
}

type FxRatesWorkerSourceGuard = (
  input: FxRatesWorkerSourceContext,
) => Promise<boolean> | boolean;

export const FX_RATES_WORKER_DESCRIPTOR = defineWorkerDescriptor({
  id: "fx-rates",
  envKey: "FX_RATES_WORKER_INTERVAL_MS",
  defaultIntervalMs: 60_000,
  description: "Refresh expired FX source rates",
});

export function createFxRatesWorkerDefinition(deps: {
  id?: string;
  intervalMs?: number;
  fxService: FxService;
  logger?: Logger;
  beforeSourceSync?: FxRatesWorkerSourceGuard;
}): BedrockWorker {
  const { fxService, logger } = deps;
  const beforeSourceSync = deps.beforeSourceSync;

  async function runPass(now: Date) {
    const statuses = await fxService.getRateSourceStatuses(now);

    let processed = 0;
    for (const status of statuses) {
      if (!status.isExpired) continue;
      const source = status.source as FxRateSource;

      if (beforeSourceSync) {
        const isEnabled = await beforeSourceSync({ source });
        if (!isEnabled) {
          continue;
        }
      }

      try {
        await fxService.syncRatesFromSource({
          source,
          now,
          force: true,
        });
        processed++;
      } catch (error) {
        logger?.error("FX source sync failed", {
          source: status.source,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return processed;
  }

  async function runOnce(ctx: WorkerRunContext): Promise<WorkerRunResult> {
    const processed = await runPass(ctx.now);
    return { processed };
  }

  return {
    id: deps.id ?? "fx-rates",
    intervalMs: deps.intervalMs ?? 60_000,
    runOnce,
  };
}
