import { type Logger } from "@bedrock/kernel";

import { type FxService } from "./service";
import { type FxRateSource } from "./sources";

export interface FxRatesWorkerSourceContext {
    source: FxRateSource;
}

type FxRatesWorkerSourceGuard = (
    input: FxRatesWorkerSourceContext,
) => Promise<boolean> | boolean;

export function createFxRatesWorker(deps: {
    fxService: FxService;
    logger?: Logger;
    beforeSourceSync?: FxRatesWorkerSourceGuard;
}) {
    const { fxService, logger } = deps;
    const beforeSourceSync = deps.beforeSourceSync;

    async function processOnce(opts?: { now?: Date }) {
        const now = opts?.now ?? new Date();
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

    return {
        processOnce,
    };
}
