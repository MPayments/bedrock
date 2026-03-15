import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

import type { FxService } from "../../service";
import type { FxRateSource } from "../../domain/rate-source";

export interface FxRatesWorkerSourceContext {
  source: FxRateSource;
}

type FxRatesWorkerSourceGuard = (
  input: FxRatesWorkerSourceContext,
) => Promise<boolean> | boolean;

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
    const statuses = await fxService.rates.getRateSourceStatuses(now);

    let processed = 0;
    for (const status of statuses) {
      if (!status.isExpired) {
        continue;
      }

      const source = status.source as FxRateSource;
      if (beforeSourceSync) {
        const isEnabled = await beforeSourceSync({ source });
        if (!isEnabled) {
          continue;
        }
      }

      try {
        await fxService.rates.syncRatesFromSource({
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
