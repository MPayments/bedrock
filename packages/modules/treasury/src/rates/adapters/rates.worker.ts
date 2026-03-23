import type { Logger } from "@bedrock/platform/observability/logger";
import type {
  BedrockWorker,
  WorkerRunContext,
  WorkerRunResult,
} from "@bedrock/platform/worker-runtime";

import type { TreasuryModule } from "../../module";
import type { RateSource } from "../../shared/application/external-ports";

export interface RatesWorkerSourceContext {
  source: RateSource;
}

type RatesWorkerSourceGuard = (
  input: RatesWorkerSourceContext,
) => Promise<boolean> | boolean;

export function createTreasuryRatesWorkerDefinition(deps: {
  id?: string;
  intervalMs?: number;
  treasuryModule: Pick<TreasuryModule, "rates">;
  logger?: Logger;
  beforeSourceSync?: RatesWorkerSourceGuard;
}): BedrockWorker {
  const { treasuryModule, logger } = deps;
  const beforeSourceSync = deps.beforeSourceSync;

  async function runPass(now: Date) {
    const statuses = await treasuryModule.rates.queries.getRateSourceStatuses(
      now,
    );

    let processed = 0;
    for (const status of statuses) {
      if (!status.isExpired) {
        continue;
      }

      const source = status.source as RateSource;
      if (beforeSourceSync) {
        const isEnabled = await beforeSourceSync({ source });
        if (!isEnabled) {
          continue;
        }
      }

      try {
        await treasuryModule.rates.commands.syncRatesFromSource({
          source,
          now,
          force: true,
        });
        processed++;
      } catch (error) {
        const cause =
          error instanceof Error && error.cause instanceof Error
            ? error.cause.message
            : undefined;
        logger?.error("Treasury rate source sync failed", {
          source: status.source,
          error: error instanceof Error ? error.message : String(error),
          cause,
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
    id: deps.id ?? "treasury-rates",
    intervalMs: deps.intervalMs ?? 60_000,
    runOnce,
  };
}
